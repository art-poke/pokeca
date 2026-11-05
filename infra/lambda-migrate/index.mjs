import pg from "pg";
import path from "node:path";
import { migrate } from "./migrate.mjs";

// 번들된 sql/ 디렉터리를 RDS에 적용. 기준선(00_, 01_)은 처음 한 번, 이후는 sql/migrations/*.sql 중
// 아직 기록 없는 것만 실행한다(기록: public.schema_migrations). invoke 전용(Function URL 없음).
export const handler = async () => {
  const client = new pg.Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    statement_timeout: 50000,
  });
  const dir = path.join(process.env.LAMBDA_TASK_ROOT || process.cwd(), "sql");
  await client.connect();
  try {
    const result = await migrate(client, dir);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (e) {
    return { statusCode: 500, body: `MIGRATE FAIL: ${e.message}` };
  } finally {
    await client.end().catch(() => {});
  }
};
