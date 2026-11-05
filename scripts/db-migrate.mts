// 로컬 DB에 스키마 적용. 운영의 migrate Lambda와 같은 로직(infra/lambda-migrate/migrate.mjs)을 DATABASE_URL에 돌린다.
//   npm run db:migrate            # infra/db(기준선 00_/01_ + migrations/*.sql) 중 아직 안 한 것만 실행
import { Client } from "pg";
import path from "node:path";
import { migrate } from "../infra/lambda-migrate/migrate.mjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL이 필요해요(.env.local 또는 환경 변수).");
  process.exit(2);
}
const client = new Client({ connectionString: url });
await client.connect();
try {
  const r = await migrate(client, path.resolve("infra/db"));
  const u = new URL(url);
  console.log(`대상: ${u.hostname}:${u.port || 5432}${u.pathname}`);
  console.log(`실행 ${r.applied.length}: ${r.applied.join(", ") || "-"}`);
  if (r.recorded.length) console.log(`기록만(기존 DB 기준선): ${r.recorded.join(", ")}`);
  console.log(`건너뜀 ${r.skipped.length} · 테이블 ${r.tables}개`);
} finally {
  await client.end();
}
