// 카드 시드 CSV를 DB에 넣는다.
//
//   npm run cards:import -- cards.csv            # 검사만 하고 몇 장이 추가·갱신될지 보여 준다
//   npm run cards:import -- cards.csv --apply    # 실제로 넣는다
//
// 대상 DB는 DATABASE_URL(.env.local 또는 환경 변수). 운영(RDS)에 넣을 때는 운영 URL을 준다.
// 문제가 하나라도 있으면 아무것도 쓰지 않는다(DB 함수 cards_import가 한 트랜잭션으로 처리).
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { parseCardImport, type ImportError } from "../lib/card-import.ts";

function fail(errors: ImportError[]): never {
  for (const e of errors) console.error(e.line ? `${e.line}행: ${e.message}` : e.message);
  console.error(`\n오류 ${errors.length}건. 아무것도 넣지 않았어요.`);
  process.exit(1);
}

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const apply = args.includes("--apply");
if (!file) {
  console.error("사용법: npm run cards:import -- <cards.csv> [--apply]");
  process.exit(2);
}

const parsed = parseCardImport(readFileSync(file, "utf8"));
if (parsed.errors.length) fail(parsed.errors);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL이 필요해요(.env.local 또는 환경 변수).");
  process.exit(2);
}

const pool = new Pool({ connectionString: url });
try {
  const { rows } = await pool.query<{ r: { ok: boolean; errors?: ImportError[]; inserted: number; updated: number; aliases: number } }>(
    "select public.cards_import($1::jsonb, $2::jsonb, $3) as r",
    [JSON.stringify(parsed.sets), JSON.stringify(parsed.cards), !apply],
  );
  const data = rows[0].r;
  if (!data.ok) fail(data.errors ?? []);

  // 비밀번호는 가리고 호스트/DB만 보여 준다(운영 DB 실수 방지용 "대상" 확인).
  const u = new URL(url);
  console.log(`대상: ${u.hostname}:${u.port || 5432}${u.pathname}`);
  console.log(`카드 ${parsed.cards.length}장: 새로 ${data.inserted}장, 갱신 ${data.updated}장 · 별칭 ${data.aliases}개`);
  console.log(apply ? "넣었어요." : "검사만 했어요. 넣으려면 --apply를 붙여 다시 실행하세요.");
} finally {
  await pool.end();
}
