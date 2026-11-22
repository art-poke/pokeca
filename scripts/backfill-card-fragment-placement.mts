// Apply to published card puzzles after upgrading the publisher.
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import sharp from "sharp";
import { cardPlacement, cropFrame, nameCropCenters, NAME_CROP_ZOOM, NAME_OPENING_VARIANT, NAME_OPENING_ZOOM, oddCrop, oddCropCenter, ODD_VARIANT_COUNT, type Artwork, type CardPlacement, type NamePlacements, type Point } from "../domains/card-fragments/crop.ts";

type PublishedCard = { name: string; set: string; number: string; source: string; cameo?: string; placements?: CardPlacement[]; namePlacements?: NamePlacements; openingPlacements?: NamePlacements };
type SourceCard = PublishedCard & { area: Artwork; centers: Point[]; oddCenters?: Point[]; oddDetailCenters?: Point[] };
type Book = { cards: Record<string, SourceCard> } | Array<{ game: string; cards: SourceCard[] }>;
type Puzzle = { day: string; game: "name" | "odd"; stage: number; cards: PublishedCard[] };

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL이 필요해요.");

const folder = "data/card-fragments";
const files = ["data/card-fragments-starter.json", ...(await readdir(folder)).filter((file) => file.endsWith(".json")).sort().map((file) => path.join(folder, file))];
const sources = new Map<string, SourceCard>();
const key = (card: PublishedCard) => JSON.stringify([card.set.toLowerCase(), card.number, card.source]);
for (const file of files) {
  const book = JSON.parse(await readFile(file, "utf8")) as Book;
  const cards = Array.isArray(book) ? book.flatMap((puzzle) => puzzle.cards) : Object.values(book.cards);
  for (const card of cards) {
    const id = key(card);
    const previous = sources.get(id);
    if (!previous || card.oddCenters?.length) sources.set(id, card);
  }
}

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query("begin");
  const { rows: puzzles } = await db.query<Puzzle>(`
    select day::text, game, stage, cards from card_fragment_puzzles
    where answer_kind = 'pokemon' and exists (
      select 1 from jsonb_array_elements(cards) card
      where (game = 'odd' and coalesce(jsonb_array_length(card->'placements'), 0) <> $1)
         or (game = 'name' and (not card ? 'namePlacements' or not card ? 'openingPlacements'))
    )
    order by day, stage for update
  `, [ODD_VARIANT_COUNT]);
  async function prepare(original: Buffer, source: SourceCard, seed: number, game: Puzzle["game"], details?: Point[], hasNamePlacements = false) {
    const { width, height } = await sharp(original).metadata();
    if (!width || !height) throw new Error("공개 카드 이미지 크기를 읽을 수 없어요.");
    if (game === "name") {
      const centers = nameCropCenters(width, height, source.area, source.centers[0]);
      const standard = hasNamePlacements ? [] : centers.map((_, variant) => ({
        center: centers[(seed + variant) % centers.length], variant, zoom: NAME_CROP_ZOOM,
      }));
      const opening = NAME_OPENING_ZOOM.map((zoom, level) => ({
        center: source.centers[0], variant: NAME_OPENING_VARIANT + level, zoom,
      }));
      return Promise.all([...standard, ...opening].flatMap(({ center, variant, zoom }) =>
        (["close", "wide"] as const).map(async (frame) => {
          const crop = cropFrame(width, height, source.area, center, zoom[frame]);
          const image = await sharp(original).extract(crop).webp({ quality: 94 }).toBuffer();
          return { frame, variant, image, placement: cardPlacement(width, height, crop) };
        }),
      ));
    }
    const centers = source.oddCenters?.length ? source.oddCenters : source.centers;
    return Promise.all(Array.from({ length: ODD_VARIANT_COUNT }, async (_entry, variant) => {
      const center = oddCropCenter(centers, details, seed, variant);
      const { crop, placement } = oddCrop(width, height, source.area, center, seed, variant);
      const image = await sharp(original).extract(crop).webp({ quality: 94 }).toBuffer();
      return { frame: "close" as const, variant, image, placement };
    }));
  }

  for (const { day, game, stage, cards } of puzzles) {
    const sourceCards = cards.map((card) => sources.get(key(card)));
    const detailCard = sourceCards.find((card) => card?.cameo && card.oddDetailCenters?.length)
      ?? sourceCards.find((card) => card?.oddDetailCenters?.length);
    const { rows: reveals } = await db.query<{ slot: number; image: Buffer }>(`
      select slot, image from card_fragment_images
      where day = $1 and game = $2 and stage = $3 and frame = 'reveal' and variant = 0
      order by slot
    `, [day, game, stage]);
    if (reveals.length !== cards.length) throw new Error(`${day} ${stage}: 공개 카드가 빠졌어요.`);
    if (game === "name" && cards.some((card) => !card.namePlacements)) {
      await db.query("delete from card_fragment_images where day = $1 and game = $2 and stage = $3 and frame <> 'reveal'", [day, game, stage]);
    }
    const updated = [];
    for (const { slot, image } of reveals) {
      const card = cards[slot];
      const source = sourceCards[slot];
      if (!source) throw new Error(`${day} ${stage}: ${card.set} ${card.number}의 일러스트 영역을 찾을 수 없어요.`);
      const seed = createHash("sha256").update(`${day}/${game}/${card.set}/${card.number}${stage === 1 ? "" : "/" + stage}`).digest().readUInt32BE();
      const positioned = await prepare(image, source, seed, game, source === detailCard ? source.oddDetailCenters : undefined, Boolean(card.namePlacements));
      for (const { variant, frame, image } of positioned) {
        await db.query(`
          insert into card_fragment_images (day, game, stage, slot, frame, variant, image)
          values ($1, $2, $3, $4, $5, $6, $7)
          on conflict (day, game, stage, slot, frame, variant) do update set image = excluded.image
        `, [day, game, stage, slot, frame, variant, image]);
      }
      if (game === "name") {
        const placements = (opening: boolean): NamePlacements => ({
          close: positioned.filter((frame) => frame.frame === "close" && (frame.variant >= NAME_OPENING_VARIANT) === opening).map((frame) => frame.placement),
          wide: positioned.filter((frame) => frame.frame === "wide" && (frame.variant >= NAME_OPENING_VARIANT) === opening).map((frame) => frame.placement),
        });
        updated.push({ ...card, namePlacements: card.namePlacements ?? placements(false), openingPlacements: placements(true) });
      } else updated.push({ ...card, placements: positioned.map((frame) => frame.placement) });
    }
    await db.query("update card_fragment_puzzles set cards = $4 where day = $1 and game = $2 and stage = $3",
      [day, game, stage, JSON.stringify(updated)]);
  }
  await db.query("commit");
  console.log(`문제 ${puzzles.length}개의 카드 조각 위치를 기록했어요.`);
} catch (error) {
  await db.query("rollback");
  throw error;
} finally {
  await db.end();
}
