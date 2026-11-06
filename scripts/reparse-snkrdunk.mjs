// 저장된 raw_title을 최신 parseItem으로 다시 파싱해 필드만 갱신한다(재크롤 없음, 스니덩크 부하 0).
//   node --env-file=.env.local scripts/reparse-snkrdunk.mjs
import pg from "pg";
import { parseItem } from "./fetch-snkrdunk.mjs";

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const { rows } = await db.query("select source_id, raw_title from public.snkrdunk_cards");
let updated = 0, failed = 0;
for (const r of rows) {
  const p = parseItem(r.raw_title);
  if (!p) { failed++; continue; }
  await db.query(
    `update public.snkrdunk_cards set set_code=$2, collector_number=$3, total=$4, set_name=$5, rarity=$6, lang=$7 where source_id=$1`,
    [r.source_id, p.set_code, p.collector_number, p.total, p.set_name, p.rarity, p.lang],
  );
  updated++;
}
await db.end();
console.log(`재파싱 완료 — 갱신 ${updated}, 실패 ${failed}`);
