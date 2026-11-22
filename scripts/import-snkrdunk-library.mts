// A reviewed name-quiz catalog is also the import list for searchable Japanese cards.
// node --env-file-if-exists=.env.local scripts/import-snkrdunk-library.mts data/card-fragments/snkrdunk-01.json
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import sharp from "sharp";

type CatalogCard = {
  sourceId: string;
  name: string;
  titleKo: string;
  nameEn: string;
  kind: "pokemon" | "trainer";
  keyword: string;
  set: string;
  number: string;
  setName: string;
  rarity: string;
  image: string;
  source: string;
};

const [manifestPath] = process.argv.slice(2);
if (!manifestPath || !process.env.DATABASE_URL) throw new Error("카드 목록 파일과 DATABASE_URL을 지정하세요.");

const input = JSON.parse(await readFile(manifestPath, "utf8")) as { cards: Record<string, CatalogCard>; catalog?: string[] };
const cards = input.catalog?.map((key) => {
  const card = input.cards[key];
  if (!card) throw new Error(`수집 목록의 카드가 빠졌어요. ${key}`);
  return card;
}) ?? Object.values(input.cards);
const ids = new Set<string>();
for (const card of cards) {
  if (!/^\d+$/.test(card.sourceId) || ids.has(card.sourceId) || !/^[a-z0-9]+$/.test(card.set) || !/^\d{3}\/\d{3}$/.test(card.number)
      || !card.name || !card.titleKo || !card.nameEn || !card.keyword || !card.setName || !card.rarity
      || (card.kind !== "pokemon" && card.kind !== "trainer")
      || card.source !== `https://snkrdunk.com/en/trading-cards/${card.sourceId}`
      || !/^https:\/\/cdn\.snkrdunk\.com\/upload_bg_removed\/[a-z0-9-]+\.webp$/i.test(card.image)) {
    throw new Error(`카드 수집 정보가 올바르지 않아요. ${card.sourceId}`);
  }
  ids.add(card.sourceId);
}

const imageDir = path.join(".cache", "snkrdunk-images");
await mkdir(imageDir, { recursive: true });
for (const card of cards) {
  const imagePath = path.join(imageDir, `${card.sourceId}.webp`);
  const cached = await readFile(imagePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  if (cached && (await sharp(cached).metadata().catch(() => null))?.format === "webp") continue;
  const response = await fetch(card.image, { signal: AbortSignal.timeout(25_000), redirect: "error" });
  if (!response.ok) throw new Error(`${card.sourceId} 이미지 다운로드 실패 (HTTP ${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(imagePath, await sharp(buffer).trim({ threshold: 4 }).webp({ quality: 92 }).toBuffer());
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("begin");
  await client.query("lock table public.cards in share row exclusive mode");
  let added = 0, linked = 0, official = 0;
  for (const card of cards) {
    const [number, total] = card.number.split("/");
    const filename = `${card.sourceId}.webp`;
    await client.query(
      `insert into public.snkrdunk_cards
        (source_id, species, species_ko, name_en, rarity, set_code, collector_number, total, set_name, image_path, source_url, raw_title, lang)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ja')
       on conflict (source_id) do update
       set species_ko = excluded.species_ko, name_en = excluded.name_en, image_path = excluded.image_path, fetched_at = now()`,
      [card.sourceId, card.keyword, card.name, card.nameEn, card.rarity, card.set, number, total, card.setName, filename, card.source,
        `${card.nameEn} [${card.set} ${card.number}](${card.setName})`],
    );
    const existing = (await client.query<{ id: string; lang: string }>(
      `select id, lang from public.cards
       where lower(set_code) = $1 and normalize_collector_number(split_part(collector_number, '/', 1)) = normalize_collector_number($2)
       order by (lang = 'ko') desc, (collector_number = $3) desc, id limit 1`,
      [card.set, number, card.number],
    )).rows[0];
    if (existing?.lang === "ko") {
      official++;
      continue;
    }
    if (existing) {
      await client.query(
        `update public.cards set image_path = $1,
           name_ko = case when strpos(name_ko, $3) > 0 then name_ko else concat_ws(' ', $4::text, name_ko) end
         where id = $2 and (image_path is distinct from $1 or coalesce(strpos(name_ko, $3), 0) = 0)`,
        [filename, existing.id, card.name, card.titleKo],
      );
      linked++;
      continue;
    }
    await client.query("insert into public.sets (code, name_ko) values ($1, $2) on conflict (code) do nothing", [card.set, card.setName]);
    await client.query(
      `insert into public.cards (set_code, collector_number, name_ko, rarity, image_path, lang)
       values ($1, $2, $3, $4, $5, 'ja')`,
      [card.set, card.number, `${card.titleKo} ${card.nameEn}`, card.rarity, filename],
    );
    added++;
  }
  await client.query("commit");
  console.log(`SNKRDUNK ${cards.length}장 · 검색 신규 ${added}장 · 기존 일본판 이미지 연결 ${linked}장 · 기존 한국판 유지 ${official}장`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
