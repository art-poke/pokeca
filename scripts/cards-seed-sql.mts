// 카드 시드 CSV(+이미지 manifest)를 migrate Lambda가 실행할 마이그레이션 SQL 한 파일로 만든다.
// 운영 RDS는 외부에서 직접 접속하지 않으므로(private), 카드 데이터도 스키마와 같은 경로(infra/db/migrations → Lambda)로 넣는다.
//
//   npm run cards:seed-sql -- --out infra/db/migrations/20261105_130000_cards_seed.sql
//   옵션: --csv data/cards-kr.csv  --images data/card-images.csv(없으면 image_path 생략)
//
// 만들어진 파일은 cards_import(기존 plpgsql, upsert) 호출 + image_path 갱신을 한 트랜잭션으로 묶는다. 재실행해도 같은 결과.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCardImport } from "../lib/card-import.ts";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const csvPath = opt("csv") ?? "data/cards-kr.csv";
const imagesPath = opt("images") ?? "data/card-images.csv";
const outPath = opt("out");
if (!outPath) {
  console.error("사용법: npm run cards:seed-sql -- --out infra/db/migrations/<YYYYMMDD_HHMMSS>_cards_seed.sql");
  process.exit(2);
}

const parsed = parseCardImport(await readFile(csvPath, "utf8"));
if (parsed.errors.length) {
  for (const e of parsed.errors) console.error(e.line ? `${e.line}행: ${e.message}` : e.message);
  process.exit(1);
}

// 이미지 manifest(status=ok)만 → S3 키 cards/{세트}/{파일}. 세트 폴더는 공식 표기(대소문자) 그대로.
const images: [string, string, string][] = [];
const manifest = await readFile(imagesPath, "utf8").catch(() => "");
for (const line of manifest.split(/\r?\n/).slice(1)) {
  const [set, number, file, , status] = line.split(",");
  if (status === "ok" && file) images.push([set.toLowerCase(), number, `cards/${set}/${path.basename(file)}`]);
}

// JSON은 달러 인용($j$…$j$)으로 넣는다. JSON 본문에 $j$가 들어갈 일은 없지만 혹시 몰라 확인.
const TAG = "$j$";
const setsJson = JSON.stringify(parsed.sets);
const cardsJson = JSON.stringify(parsed.cards);
if (setsJson.includes(TAG) || cardsJson.includes(TAG)) throw new Error(`JSON 안에 ${TAG}가 있어요`);
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

const sql = `-- scripts/cards-seed-sql.mts 로 생성(${csvPath}${images.length ? ` + ${imagesPath}` : ""}). 손으로 고치지 말 것.
-- 카드 ${parsed.cards.length}장·세트 ${parsed.sets.length}개를 cards_import(upsert)로 넣고, 이미지 ${images.length}장의 image_path를 채운다.
do $$
declare r jsonb;
begin
  r := public.cards_import(${TAG}${setsJson}${TAG}::jsonb, ${TAG}${cardsJson}${TAG}::jsonb, false);
  if not (r ->> 'ok')::boolean then
    raise exception 'cards_import 실패: %', r -> 'errors';
  end if;
  raise notice 'cards_import: %', r;
end $$;
${
  images.length
    ? `
update public.cards as c set image_path = v.image_path
from (values
${images.map(([s, n, p]) => `  (${lit(s)}, ${lit(n)}, ${lit(p)})`).join(",\n")}
) as v(set_code, collector_number, image_path)
where c.set_code = v.set_code and c.collector_number = v.collector_number;
`
    : ""
}`;

await writeFile(outPath, sql);
console.log(`${outPath}: 카드 ${parsed.cards.length}장 · 세트 ${parsed.sets.length}개 · 이미지 ${images.length}장 · ${(sql.length / 1024).toFixed(0)}KB`);
