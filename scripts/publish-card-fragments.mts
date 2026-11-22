// 로컬 미리보기와 이미지 준비: node --env-file-if-exists=.env.local scripts/publish-card-fragments.mts data/card-fragments-starter.json YYYY-MM-DD --preview /tmp/card-fragments
// 발행: --preview /tmp/card-fragments를 빼고 로컬 또는 발행 대상 DB의 DATABASE_URL을 지정한다.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import sharp from "sharp";
import { cardPlacement, cropFrame, NAME_CROP_ZOOM, NAME_OPENING_VARIANT, NAME_OPENING_ZOOM, nameCropCenters, oddCrop, oddCropCenter, ODD_VARIANT_COUNT, type Artwork, type CardPlacement, type NamePlacements, type Point } from "../domains/card-fragments/crop.ts";
import { isGame, koreaDay, BANK_ROUNDS, type AnswerKind, type Frame, type Game } from "../domains/card-fragments/rules.ts";

type Card = {
  name: string;
  species: string;
  set: string;
  number: string;
  source: string;
  image: string;
  trim?: boolean;
  detailUrl?: string;
  cameo?: string;
  shiny?: boolean;
  area: Artwork;
  centers: Point[];
  oddCenters?: Point[];
  oddDetailCenters?: Point[];
};

type GameDraft = { game: Game; cards: Card[]; aliases?: string[]; answerKind?: AnswerKind };
type Image = { slot: number; frame: Frame; variant: number; bytes: Buffer };
type NameDraft = { card: string; aliases?: string[]; answerKind?: AnswerKind };
type OddDraft = [string, string, string];

type QuizBook = {
  cards: Record<string, Card>;
  days: Record<string, [NameDraft, OddDraft?] | [null, OddDraft]>;
  stages?: Record<number, QuizBook["days"]>;
};

const [file, dateArg, ...options] = process.argv.slice(2);
const stageOption = options.indexOf("--stage");
const stage = stageOption === -1 ? 1 : Number(options[stageOption + 1]);
if (stageOption !== -1) options.splice(stageOption, 2);
const previewDir = options[0] === "--preview" ? options[1] : undefined;
const replaceUnplayed = options[0] === "--replace-unplayed";
const bankOnly = options[0] === "--bank-only";
const refreshGame = options[0] === "--refresh-odd-crops" ? "odd" : options[0] === "--refresh-name-crops" ? "name" : null;
function isValidDay(day: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day))
    && new Date(day).toISOString().slice(0, 10) === day;
}
if (!file || !dateArg || (dateArg !== "--all" && !isValidDay(dateArg))
    || !Number.isInteger(stage) || stage < 1 || stage > BANK_ROUNDS
    || (options.length && !((previewDir && options.length === 2) || ((replaceUnplayed || bankOnly || refreshGame) && options.length === 1)))) {
  throw new Error("입력 목록과 날짜(YYYY-MM-DD) 또는 --all을 지정하세요. 미리보기는 --preview <경로>를 추가하세요.");
}
if (!previewDir && !process.env.DATABASE_URL) throw new Error("발행에는 DATABASE_URL이 필요해요.");

const cachedImages = new Map<string, Buffer>();
async function getSource(card: Card) {
  const cached = cachedImages.get(card.image);
  if (cached) return cached;
  let bytes: Buffer;
  if (card.image.startsWith("https://")) {
    const response = await fetch(card.image, { signal: AbortSignal.timeout(25_000) });
    if (!response.ok) throw new Error(`${card.set} ${card.number} 다운로드 실패 (HTTP ${response.status})`);
    bytes = Buffer.from(await response.arrayBuffer());
  } else {
    bytes = await readFile(path.resolve(path.dirname(file), card.image));
  }
  cachedImages.set(card.image, bytes);
  return bytes;
}

const decoded = JSON.parse(await readFile(file, "utf8")) as GameDraft[] | QuizBook;
const calendar: [string, GameDraft[]][] = Array.isArray(decoded)
  ? [[dateArg, decoded]]
  : Object.entries(stage === 1 ? decoded.days : decoded.stages?.[stage] ?? {})
    .filter(([day]) => dateArg === "--all" || dateArg === day)
    .map(([day, [name, odd]]) => {
      const getCard = (key: string) => {
        const card = decoded.cards[key];
        if (!card) throw new Error(`${day}에 등록되지 않은 카드가 있어요. ${key}`);
        return card;
      };
      return [day, [
        ...(name ? [{ game: "name" as const, aliases: name.aliases, answerKind: name.answerKind, cards: [getCard(name.card)] }] : []),
        ...(odd ? [{ game: "odd" as const, cards: odd.map(getCard) }] : []),
      ]];
    });
if (!calendar.length || calendar.some(([day]) => !isValidDay(day))) throw new Error("발행할 날짜가 없거나 잘못됐어요.");
if (replaceUnplayed && calendar.some(([day]) => day <= koreaDay())) {
  throw new Error("이미 공개된 날짜는 교체할 수 없어요.");
}

const originals = new Map<string, { original: Buffer; width: number; height: number; reveal: Buffer }>();
const cachedCrops = new Map<string, Buffer>();
async function prepareImage(card: Card) {
  const imageKey = JSON.stringify([card.image, card.trim]);
  const cached = originals.get(imageKey);
  if (cached) return cached;
  const input = await getSource(card);
  const original = card.trim ? await sharp(input).trim({ threshold: 4 }).png().toBuffer() : input;
  const { width, height } = await sharp(original).metadata();
  if (!width || !height) throw new Error("원본 이미지 크기를 읽을 수 없어요.");
  const reveal = await sharp(original).resize({ height: 900, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
  const prepared = { original, width, height, reveal };
  originals.set(imageKey, prepared);
  return prepared;
}

const puzzles = [];
for (const [day, drafts] of calendar) {
  const gameKeys = new Set<Game>();
  const cardKeys = new Set<string>();
  for (const draft of drafts) {
    const { game, aliases = [], answerKind = "pokemon" } = draft;
    if (refreshGame && game !== refreshGame) continue;
    if (answerKind !== "pokemon"
      || !isGame(game) || gameKeys.has(game) || draft.cards.length !== (game === "name" ? 1 : 3)) {
      throw new Error("게임별로 하나의 문제와 필요한 카드 수를 지정하세요.");
    }
    gameKeys.add(game);
    const groupSizes = new Map<string, number>();
    for (const card of draft.cards) {
      const key = `${card.set.toLowerCase()}:${card.number}`;
      if (cardKeys.has(key)) throw new Error(`같은 날 카드가 중복됐어요. ${key}`);
      if (!card.name || !card.species || !card.set || !card.number || !card.source || !card.centers.length) {
        throw new Error(`카드 출제 정보가 빠졌어요. ${key}`);
      }
      if (card.detailUrl && !/^https:\/\/snkrdunk\.com\/en\/trading-cards\/\d+$/.test(card.detailUrl)) {
        throw new Error(`외부 카드 상세 주소가 올바르지 않아요. ${key}`);
      }
      cardKeys.add(key);
      groupSizes.set(card.species, (groupSizes.get(card.species) ?? 0) + 1);
    }
    if (game === "odd" && [...groupSizes.values()].sort().join(",") !== "1,2") {
      throw new Error("다른 포켓몬 찾기는 동일 종 2장과 다른 종 1장이 필요해요.");
    }

    const order = (card: Card) => createHash("sha256").update(`${day}/${game}/${card.set}/${card.number}${stage === 1 ? "" : "/" + stage}`).digest();
    const cards = [...draft.cards].sort((a, b) => Buffer.compare(order(a), order(b)));
    const answer = game === "name" ? 0 : cards.findIndex((card) => groupSizes.get(card.species) === 1);
    const detailCard = game === "odd"
      ? cards.find((card) => card.cameo && card.oddDetailCenters?.length) ?? cards.find((card) => card.oddDetailCenters?.length)
      : undefined;
    const images: Image[] = [];
    const placements: CardPlacement[][] = [];
    const namePlacements: NamePlacements = { close: [], wide: [] };
    const openingPlacements: NamePlacements = { close: [], wide: [] };
    for (const [slot, card] of cards.entries()) {
      const { original, width, height, reveal } = await prepareImage(card);
      const seed = order(card).readUInt32BE(0);
      const centers = game === "name"
        ? nameCropCenters(width, height, card.area, card.centers[0])
        : (card.oddCenters?.length ? card.oddCenters : card.centers);
      const frames = game === "name" ? ["close", "wide"] as const : ["close"] as const;
      const variantCount = game === "name" ? centers.length : ODD_VARIANT_COUNT;
      for (let variant = 0; variant < variantCount; variant++) {
        const center = game === "odd" ? oddCropCenter(centers, card === detailCard ? card.oddDetailCenters : undefined, seed, variant) : centers[(seed + variant) % centers.length];
        for (const frame of frames) {
          const positioned = game === "odd" ? oddCrop(width, height, card.area, center, seed, variant) : null;
          if (positioned) (placements[slot] ??= []).push(positioned.placement);
          const crop = positioned?.crop ?? cropFrame(width, height, card.area, center, NAME_CROP_ZOOM[frame]);
          if (game === "name") namePlacements[frame].push(cardPlacement(width, height, crop));
          const cropKey = JSON.stringify([card.image, card.trim, crop]);
          let bytes = cachedCrops.get(cropKey);
          if (!bytes) {
            bytes = await sharp(original).extract(crop).resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
              .webp({ quality: 94 }).toBuffer();
            cachedCrops.set(cropKey, bytes);
          }
          images.push({ slot, frame, variant, bytes });
        }
      }
      if (game === "name") {
        for (const [level, zoom] of NAME_OPENING_ZOOM.entries()) {
          for (const frame of ["close", "wide"] as const) {
            const crop = cropFrame(width, height, card.area, card.centers[0], zoom[frame]);
            openingPlacements[frame].push(cardPlacement(width, height, crop));
            const bytes = await sharp(original).extract(crop).resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
              .webp({ quality: 94 }).toBuffer();
            images.push({ slot, frame, variant: NAME_OPENING_VARIANT + level, bytes });
          }
        }
      }
      images.push({ slot, frame: "reveal", variant: 0, bytes: reveal });
    }
    puzzles.push({ day, game, cards: cards.map(({ name, set, number, source, detailUrl, cameo, shiny }, slot) => ({ name, set, number, source, detailUrl, cameo, shiny, placements: placements[slot], namePlacements: game === "name" ? namePlacements : undefined, openingPlacements: game === "name" ? openingPlacements : undefined })), aliases, answerKind, answer, images });
  }
}

if (previewDir) {
  await mkdir(previewDir, { recursive: true });
  for (const puzzle of puzzles) {
    const { day } = puzzle;
    for (const { slot, frame, variant, bytes } of puzzle.images) {
      await writeFile(path.join(previewDir, `${day}-${puzzle.game}${stage === 1 ? "" : "-stage" + stage}-${slot + 1}-${frame}${variant === 0 ? "" : "-v" + variant}.webp`), bytes);
    }
  }
} else {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("begin");
    for (const { day, game, cards, aliases, answerKind, answer, images } of puzzles) {
      if (refreshGame) {
        const result = await client.query<{ cards: Card[]; answer_slot: number }>(
          "select cards, answer_slot from card_fragment_puzzles where day = $1 and game = $2 and stage = $3 for update", [day, game, stage],
        );
        const previous = result.rows[0];
        if (!previous || previous.answer_slot !== answer || cards.length !== previous.cards.length
          || cards.some((card, slot) => card.set !== previous.cards[slot].set || card.number !== previous.cards[slot].number)) {
          throw new Error(`${day} ${game}에 발행된 카드 순서 또는 정답이 달라요.`);
        }
        if (game === "name") {
          await client.query("delete from card_fragment_images where day = $1 and game = $2 and stage = $3 and frame <> 'reveal'", [day, game, stage]);
        }
        await client.query("update card_fragment_puzzles set cards = $4 where day = $1 and game = $2 and stage = $3",
          [day, game, stage, JSON.stringify(previous.cards.map((card, slot) => ({
            ...card,
            ...(game === "odd" ? { placements: cards[slot].placements } : { namePlacements: cards[slot].namePlacements, openingPlacements: cards[slot].openingPlacements }),
          })))]);
        for (const { slot, frame, variant, bytes } of images) {
          await client.query(
            `insert into card_fragment_images (day, game, stage, slot, frame, variant, image)
             values ($1, $2, $3, $4, $5, $6, $7)
             on conflict (day, game, stage, slot, frame, variant) do update set image = excluded.image`,
            [day, game, stage, slot, frame, variant, bytes],
          );
        }
        continue;
      }
      if (replaceUnplayed) {
        if (day <= koreaDay()) throw new Error("이미 공개된 날짜는 교체할 수 없어요.");
        await client.query("select day from card_fragment_puzzles where day = $1 and game = $2 and stage = $3 for update", [day, game, stage]);
        const attempts = await client.query(
          "select 1 from card_fragment_attempts where day = $1 and game = $2 and stage = $3 limit 1", [day, game, stage],
        );
        if (attempts.rowCount) throw new Error(`${day} ${game} 문제는 이미 진행 기록이 있어요.`);
        await client.query("delete from card_fragment_puzzles where day = $1 and game = $2 and stage = $3", [day, game, stage]);
      }
      await client.query(
        "insert into card_fragment_puzzles (day, game, cards, aliases, answer_slot, stage, answer_kind, bank_only) values ($1, $2, $3, $4, $5, $6, $7, $8)",
        [day, game, JSON.stringify(cards), aliases, answer, stage, answerKind, bankOnly],
      );
      for (const { slot, frame, variant, bytes } of images) {
        await client.query(
          "insert into card_fragment_images (day, game, slot, frame, image, stage, variant) values ($1, $2, $3, $4, $5, $6, $7)",
          [day, game, slot, frame, bytes, stage, variant],
        );
      }
    }
    await client.query("commit");
    console.log(`문제 ${puzzles.length}개를 저장했어요.`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}
