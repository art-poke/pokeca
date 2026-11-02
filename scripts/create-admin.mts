// 어드민 계정을 만든다(로컬/운영 DB). 공개 가입은 없고 이 CLI로만 어드민을 넣는다.
//   npm run admin:create -- admin@pokeca.local testpw1234
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("usage: npm run admin:create -- <email> <password>");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const hash = await bcrypt.hash(password, 12);
const u = await pool.query(
  `insert into users (email, password_hash) values ($1, $2)
   on conflict (email) do update set password_hash = excluded.password_hash
   returning id`,
  [email, hash],
);
const id = u.rows[0].id as string;
await pool.query(
  `insert into admins (user_id, email) values ($1, $2) on conflict (user_id) do nothing`,
  [id, email],
);
console.log("admin ready:", email, id);
await pool.end();
