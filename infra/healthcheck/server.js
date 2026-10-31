import http from "node:http";
import pg from "pg";

const port = process.env.PORT || 8080;

async function checkDb() {
  const raw = process.env.DB_SECRET;
  if (!raw) return { ok: false, msg: "DB_SECRET 미주입" };
  const { username, password, host, port: dbPort, dbname } = JSON.parse(raw);
  const client = new pg.Client({
    user: username,
    password,
    host,
    port: dbPort,
    database: dbname,
    ssl: { rejectUnauthorized: false }, // RDS 기본 TLS (Phase 1 연결 확인용. Phase 2는 CA 검증으로 올릴 것)
    connectionTimeoutMillis: 4000,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return { ok: true, msg: "DB OK" };
  } catch (e) {
    return { ok: false, msg: `DB FAIL: ${e.message}` };
  } finally {
    await client.end().catch(() => {});
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    const r = await checkDb();
    res.writeHead(r.ok ? 200 : 503, { "content-type": "text/plain" });
    res.end(r.msg);
    return;
  }
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("pokeca healthcheck");
});

server.listen(port, () => console.log(`listening on ${port}`));
