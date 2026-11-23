// Export a new, immutable seed migration from a DB populated by publish-card-fragments.mts.
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { Client } from "pg";
import sharp from "sharp";
import type { Artwork, CropSource, Point } from "../domains/card-fragments/crop.ts";

type Card = { name: string; set: string; number: string; source: string; detailUrl?: string; cameo?: string; shiny?: boolean };
type Source = Card & { area: Artwork; centers: Point[]; oddDetailCenters?: Point[] };
type Question = { game: "name" | "odd"; cards: Card[]; aliases: string[]; answer_slot: number; signature: string };
type SeedCard = Card & { cropSource: CropSource };

const [output, namespace = "2090-01-01"] = process.argv.slice(2);
if (!output?.endsWith(".sql.gz") || !process.env.DATABASE_URL || !/^\d{4}-\d{2}-\d{2}$/.test(namespace)) {
  throw new Error("Set DATABASE_URL and provide a new .sql.gz migration filename and unused bank date.");
}
const manifestFiles = ["data/card-fragments-starter.json",
  ...(await readdir("data/card-fragments")).filter((file) => file.endsWith(".json")).sort().map((file) => `data/card-fragments/${file}`)];
const keyOf = (card: Card) => `${card.set.toLowerCase()}:${card.number}`;
const sources = new Map<string, Source>();
const sourcesByKey = new Map<string, Source>();
for (const file of manifestFiles) {
  const { cards } = JSON.parse(await readFile(file, "utf8")) as { cards?: Record<string, Source> };
  for (const card of Object.values(cards ?? {})) {
    const key = keyOf(card);
    const existing = sourcesByKey.get(key);
    if (!existing || card.cameo || (!existing.cameo && card.oddDetailCenters)) sourcesByKey.set(key, card);
    sources.set(`${key}/${card.source}`, card);
  }
}

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const { rows: questions } = await db.query<Question>(`
    select distinct on (game, signature) game, cards, aliases, answer_slot, public.card_fragment_signature(cards) as signature
    from card_fragment_puzzles where answer_kind = 'pokemon' and stage <= 3 and not (cards->0 ? 'cropSource')
    order by game, signature, exists (select 1 from jsonb_array_elements(cards) c where c ? 'cameo') desc, day, stage
  `);
  const { rows: originals } = await db.query<{ card: Card; image: Buffer }>(`
    select distinct on (card->>'set', card->>'number', card->>'source') card, i.image
    from card_fragment_puzzles p cross join lateral jsonb_array_elements(cards) with ordinality as c(card, slot)
    join card_fragment_images i on (i.day, i.game, i.stage) = (p.day, p.game, p.stage) and i.slot = c.slot - 1
    where p.answer_kind = 'pokemon' and p.stage <= 3 and i.frame = 'reveal' and i.variant = 0
    order by card->>'set', card->>'number', card->>'source', p.day, p.game, p.stage
  `);
  const assets = new Map<string, { source: CropSource; image: Buffer }>();
  for (const { card, image } of originals) {
    const key = `${keyOf(card)}/${card.source}`;
    const source = sources.get(key) ?? sourcesByKey.get(keyOf(card));
    if (!source) throw new Error(`Missing artwork bounds for ${key}`);
    const id = createHash("sha256").update(key).digest("hex").slice(0, 24);
    const { data, info } = await sharp(image).resize({ height: 480, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    const enriched = sourcesByKey.get(keyOf(card));
    const matched = enriched?.source === card.source && enriched.area.bottom - enriched.area.top > source.area.bottom - source.area.top ? enriched : source;
    const { area, centers } = matched;
    // A few old cameo entries marked only the cameo window as their artwork area.
    const narrow = area.bottom - area.top < 0.25;
    const bounds = narrow ? { left: 0.055, top: 0.135, right: 0.945, bottom: Math.max(0.53, area.bottom) } : area;
    const focus = narrow ? { x: 0.5, y: 0.36 } : centers[0];
    const details = narrow ? centers : (matched.oddDetailCenters ?? source.oddDetailCenters);
    assets.set(key, { source: { id, width: info.width, height: info.height, area: bounds, focus, details }, image: data });
  }
  const prepared = questions.map((question) => ({
    ...question,
    cards: question.cards.map((card): SeedCard => {
      const key = `${keyOf(card)}/${card.source}`;
      const asset = assets.get(key);
      if (!asset) throw new Error(`Missing reveal image for ${key}`);
      const metadata = sourcesByKey.get(keyOf(card));
      const { name, set, number, source, detailUrl, cameo, shiny } = card;
      return { name, set, number, source, detailUrl, cameo: cameo ?? metadata?.cameo, shiny: shiny ?? metadata?.shiny, cropSource: asset.source };
    }),
  }));
  const cards = new Map<string, SeedCard>();
  for (const question of prepared) {
    for (const card of question.cards) cards.set(keyOf(card), card);
  }

  // Build more traps where the Pokémon on both regular cards also appears as a guest on the odd card.
  const signatureOf = (cards: SeedCard[]) => cards.map(keyOf).sort().join("|");
  const seen = new Set(prepared.filter(({ game }) => game === "odd").map(({ cards }) => signatureOf(cards)));
  const cameoCards = [...cards.values()].filter((card) => card.cameo);
  for (const cameo of cameoCards) {
    for (const name of cameo.cameo!.split(",").map((name) => name.trim().split(" ")[0])) {
      if (name === cameo.name) continue;
      const matches = [...cards.values()].filter((card) => card.name === name);
      if (matches.length < 2) continue;
      for (let offset = 0; offset < Math.min(matches.length, 4); offset++) {
        const trio = [matches[offset], matches[(offset + 1) % matches.length], cameo];
        const signature = signatureOf(trio);
        if (seen.has(signature)) continue;
        seen.add(signature);
        prepared.push({ game: "odd", cards: trio, aliases: [], answer_slot: 2, signature });
      }
    }
  }

  // Commands are chunked so the DB can ingest the bank within the migration Lambda's limits.
  const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
  const insert = (head: string, tuples: string[], tail: string, batch = 30) => {
    const statements = [];
    for (let i = 0; i < tuples.length; i += batch) statements.push(`${head} values\n${tuples.slice(i, i + batch).join(",\n")}\n${tail};`);
    return statements.join("\n");
  };
  const assetRows = [...assets.values()].map(({ source, image }) => `(${quote(source.id)}, decode('${image.toString("base64")}', 'base64'))`);
  const puzzleRows = prepared.map(({ game, cards, aliases, answer_slot }, index) =>
    `(${quote(namespace)}::date + ${index}, ${quote(game)}, 1, ${quote(JSON.stringify(cards))}::jsonb, ${answer_slot}, array(select jsonb_array_elements_text(${quote(JSON.stringify(aliases))}::jsonb)), true, 'pokemon')`);
  const migration = [
    insert("insert into public.card_fragment_source_images(id, image)", assetRows, "on conflict (id) do nothing"),
    insert("insert into public.card_fragment_puzzles(day, game, stage, cards, answer_slot, aliases, bank_only, answer_kind)", puzzleRows, "on conflict (day, game, stage) do nothing"),
  ].join("\n");
  const zipped = gzipSync(migration, { level: 9 });
  await writeFile(output, zipped, { flag: "wx" });
  console.log({ images: assetRows.length, name: prepared.filter(({ game }) => game === "name").length,
    odd: prepared.filter(({ game }) => game === "odd").length, cameoCards: cameoCards.length,
    cameoQuestions: prepared.filter(({ game, cards }) => game === "odd" && cards.some((card) => card.cameo)).length, compressedBytes: zipped.length });
} finally {
  await db.end();
}
