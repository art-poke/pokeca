import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// 번들된 sql/ 디렉터리의 *.sql을 파일명 순서로 RDS에 적용. invoke 전용(Function URL 없음).
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
  const applied = [];
  await client.connect();
  try {
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      const sql = await readFile(path.join(dir, f), "utf8");
      await client.query(sql); // 다중 구문(simple query) 일괄 실행
      applied.push(f);
    }
    const { rows } = await client.query(
      "select count(*)::int as tables from information_schema.tables where table_schema='public' and table_type='BASE TABLE'",
    );
    return { statusCode: 200, body: JSON.stringify({ applied, tables: rows[0].tables }) };
  } catch (e) {
    return { statusCode: 500, body: `MIGRATE FAIL (applied ${JSON.stringify(applied)}): ${e.message}` };
  } finally {
    await client.end().catch(() => {});
  }
};
