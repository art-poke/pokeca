// 스키마 적용 로직. Lambda(index.mjs)와 로컬(npm run db:migrate)이 같이 쓴다.
//
// sql 디렉터리 구성:
//   sql/00_authjs.sql, sql/01_app.sql     ← 기준선(처음 만들 때 한 번). 테이블이 이미 있는 DB에서는 실행하지 않고 "적용됨"으로만 기록.
//   sql/migrations/*.sql                  ← 그 뒤 변경분. 파일명 순서로, 아직 기록 없는 것만 실행.
// 실행한 파일 이름은 public.schema_migrations 에 남긴다. 파일 하나 = 트랜잭션 하나(실패하면 그 파일만 취소, 이후 중단).
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const list = async (dir) =>
  (await readdir(dir).catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();

export async function migrate(client, dir) {
  await client.query(`create table if not exists public.schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now(),
    note text
  )`);
  const done = new Set((await client.query("select filename from public.schema_migrations")).rows.map((r) => r.filename));

  const baseline = await list(dir);
  const migrations = (await list(path.join(dir, "migrations"))).map((f) => `migrations/${f}`);

  const applied = [];
  const recorded = [];
  const skipped = [];

  const runOne = async (name, note) => {
    const sql = await readFile(path.join(dir, name), "utf8");
    await client.query("begin");
    try {
      await client.query(sql); // 다중 구문(simple query) 일괄 실행
      await client.query("insert into public.schema_migrations (filename, note) values ($1, $2)", [name, note ?? null]);
      await client.query("commit");
    } catch (e) {
      await client.query("rollback").catch(() => {});
      throw new Error(`${name}: ${e.message}`);
    }
    applied.push(name);
  };

  // 기준선: 기록이 하나도 없고 테이블이 이미 있으면(=이 도구 도입 전에 만든 DB) 실행 없이 기록만 남긴다.
  const baselinePending = baseline.filter((f) => !done.has(f));
  if (baselinePending.length) {
    const { rows } = await client.query(
      "select count(*)::int as n from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name <> 'schema_migrations'",
    );
    const existing = rows[0].n > 0;
    for (const f of baselinePending) {
      if (existing) {
        await client.query("insert into public.schema_migrations (filename, note) values ($1, $2)", [f, "baseline: 기존 DB라 실행 없이 기록"]);
        recorded.push(f);
        done.add(f);
      } else {
        await runOne(f, "baseline");
        done.add(f);
      }
    }
  }

  for (const m of migrations) {
    if (done.has(m)) {
      skipped.push(m);
      continue;
    }
    await runOne(m);
  }

  const { rows } = await client.query(
    "select count(*)::int as tables from information_schema.tables where table_schema='public' and table_type='BASE TABLE'",
  );
  return { applied, recorded, skipped, tables: rows[0].tables };
}
