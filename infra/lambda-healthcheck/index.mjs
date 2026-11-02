import pg from "pg";

// Function URL이 호출. 환경변수로 주입된 DB 자격증명으로 RDS 접속 → "DB OK".
export const handler = async () => {
  const client = new pg.Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }, // Phase 1 연결 확인용. Phase 2는 CA 검증으로.
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return { statusCode: 200, headers: { "content-type": "text/plain" }, body: "DB OK" };
  } catch (e) {
    return { statusCode: 503, headers: { "content-type": "text/plain" }, body: `DB FAIL: ${e.message}` };
  } finally {
    await client.end().catch(() => {});
  }
};
