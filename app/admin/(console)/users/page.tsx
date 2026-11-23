import Link from "next/link";
import { Suspense } from "react";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { members } from "@/lib/analytics/report";
import { analyticsLabel } from "@/lib/analytics/taxonomy";
import { UUID } from "@/lib/uuid";
import { changeMember } from "./actions";
import styles from "../../admin.module.css";

export default function Page(props: PageProps<"/admin/users">) {
  return (
    <Suspense fallback={<p>회원을 불러오는 중…</p>}>
      <Members query={props.searchParams} />
    </Suspense>
  );
}
const actions: Record<string, string> = {
  grant: "관리자 부여",
  revoke: "관리자 회수",
  suspend: "이용 정지",
  restore: "정지 해제",
};
function date(value: unknown) {
  return value
    ? new Date(String(value)).toLocaleDateString("ko-KR", {
        timeZone: "Asia/Seoul",
      })
    : "미수집";
}
async function Members({
  query,
}: {
  query: PageProps<"/admin/users">["searchParams"];
}) {
  const actor = await requireAdmin();
  const q = await query;
  const search = String(q.q ?? "")
    .trim()
    .replace(/^@/, "")
    .slice(0, 100);
  const joined = String(q.joined ?? "");
  const joinedDate = /^\d{4}-\d{2}-\d{2}$/.test(joined)
    ? new Date(joined + "T00:00:00+09:00")
    : null;
  const since = joinedDate && Number.isFinite(+joinedDate) ? joinedDate : null;
  const id = typeof q.id === "string" && UUID.test(q.id) ? q.id : null;
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(String(q.page), 10) || 1),
  );
  const provider = String(q.provider ?? "");
  const state = String(q.state ?? "");
  const role = String(q.role ?? "");
  const params = new URLSearchParams({
    q: search,
    state,
    role,
    provider,
    joined,
  });
  const list =
    await db.execute(sql`with social as (${members}) select u.id,coalesce(a.display_name,u.name,'이름 미등록') display_name,u.name social_name,coalesce(u.email,a.email) email,a.handle,u.created_at,coalesce(a.provider,account.provider) provider,
    a.deleted_at,u.suspended_at,d.user_id is not null admin,
    (select max(created_at) from events e where e.member_id=u.id) last_seen
    from social m join users u on m.id=u.id left join artists a on a.user_id=u.id left join admins d on d.user_id=u.id
    left join lateral (select provider from accounts where "userId"=u.id and provider in ('kakao','google') order by provider limit 1) account on true
    where (${id}::uuid is null or u.id=${id}::uuid) and (strpos(lower(coalesce(a.handle,'')),lower(${search}))>0
    or strpos(lower(coalesce(a.display_name,u.name,'')),lower(${search}))>0 or strpos(lower(coalesce(u.name,'')),lower(${search}))>0 or u.id::text=${search})
    and (${since}::timestamptz is null or u.created_at>=${since}::timestamptz)
    and (${provider}='' or coalesce(a.provider,account.provider)=${provider}) and (${role}='' or (d.user_id is not null)=(${role}='admin'))
    and (${state}='' or case when a.deleted_at is not null then 'withdrawn' when u.suspended_at is not null then 'suspended' else 'active' end=${state})
    order by u.created_at desc,u.id limit 31 offset ${(page - 1) * 30}`);
  const canManage =
    id &&
    (
      await db.execute(
        sql`select 1 from admins where user_id=${actor.userId} and manage_members`,
      )
    ).rows.length > 0;
  const history = id
    ? (
        await db.execute(
          sql`select action,reason,actor_id,created_at from admin_member_audit where target_id=${id} order by id desc limit 50`,
        )
      ).rows
    : [];
  const activity = id
    ? (
        await db.execute(
          sql`select type,count(*)::int n from events where member_id=${id} group by type order by n desc`,
        )
      ).rows
    : [];
  const origin = id
    ? (
        await db.execute(
          sql`select payload->>'page' page,payload->>'action' action from events where member_id=${id} and type='signup_completed' limit 1`,
        )
      ).rows[0]
    : null;
  const target = list.rows[0];
  const ordinal =
    id && target
      ? (
          await db.execute(sql`with m as (${members})
    select count(*)::int n from m where (created_at,id)<=(select created_at,id from m where id=${id}::uuid)`)
        ).rows[0].n
      : null;
  return (
    <main className={styles.console}>
      <h1 className={styles.title}>회원 관리</h1>
      {q.error && (
        <p role="alert">
          요청을 적용할 수 없습니다. 권한과 계정 상태, 사유를 확인하세요.
        </p>
      )}
      {q.saved && <p role="status">처리했습니다.</p>}
      <form className={styles.row}>
        <input
          aria-label="회원 검색"
          name="q"
          defaultValue={search}
          placeholder="닉네임 · 소셜 이름 · 핸들 · UUID"
        />
        <label>
          가입일 이후 <input name="joined" type="date" defaultValue={joined} />
        </label>
        <select aria-label="공급자" name="provider" defaultValue={provider}>
          <option value="">모든 로그인</option>
          <option value="kakao">카카오</option>
          <option value="google">구글</option>
        </select>
        <select aria-label="회원 상태" name="state" defaultValue={state}>
          <option value="">전체 상태</option>
          <option value="active">정상</option>
          <option value="suspended">정지</option>
          <option value="withdrawn">탈퇴</option>
        </select>
        <select aria-label="역할" name="role" defaultValue={role}>
          <option value="">전체 역할</option>
          <option value="admin">관리자</option>
          <option value="member">회원</option>
        </select>
        <button className={styles.secondary}>검색</button>
      </form>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {[
                "회원",
                "소셜 이름",
                "이메일",
                "로그인",
                "가입일",
                "최근 관측",
                "상태",
                "역할",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.rows.slice(0, 30).map((r) => (
              <tr key={String(r.id)}>
                <td>
                  <Link href={"/admin/users?id=" + r.id}>
                    {String(r.display_name)} {r.handle ? "@" + r.handle : ""}
                  </Link>
                </td>
                <td>
                  {r.deleted_at ? "—" : String(r.social_name || "미제공")}
                </td>
                <td>{r.deleted_at ? "—" : String(r.email || "미제공")}</td>
                <td>{analyticsLabel(String(r.provider))}</td>
                <td>{date(r.created_at)}</td>
                <td>{date(r.last_seen)}</td>
                <td>
                  {r.deleted_at ? "탈퇴" : r.suspended_at ? "정지" : "정상"}
                </td>
                <td>{r.admin ? "관리자" : "회원"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!list.rows.length && <p>조건에 맞는 회원이 없습니다.</p>}
      <nav className={styles.row}>
        {page > 1 && (
          <Link href={"?" + params + "&page=" + (page - 1)}>이전</Link>
        )}
        {list.rows.length > 30 && (
          <Link href={"?" + params + "&page=" + (page + 1)}>다음</Link>
        )}
      </nav>
      {id && target && (
        <section className={styles.section}>
          <h2 className={styles.subtitle}>회원 상세</h2>
          <p>
            소셜 가입 순서 {String(ordinal)}번째 · {id}
          </p>
          <p>
            가입 출처 ·{" "}
            {origin
              ? analyticsLabel(String(origin.page)) +
                " / " +
                analyticsLabel(String(origin.action))
              : "미수집"}
          </p>
          {activity.map((a) => (
            <p key={String(a.type)}>
              {analyticsLabel(String(a.type))} · {String(a.n)}회
            </p>
          ))}
          {canManage && id !== actor.userId && !target.deleted_at && (
            <form action={changeMember} className={styles.row}>
              <input type="hidden" name="id" value={id} />
              <select name="action" aria-label="계정 조치">
                {[
                  target.admin ? "revoke" : "grant",
                  target.suspended_at ? "restore" : "suspend",
                ].map((k) => (
                  <option key={k} value={k}>
                    {actions[k]}
                  </option>
                ))}
              </select>
              <input
                name="reason"
                aria-label="변경 사유"
                placeholder="변경 사유"
                required
                maxLength={300}
              />
              <button className={styles.secondary}>적용</button>
            </form>
          )}
          <h3>운영 이력</h3>
          {history.length ? (
            history.map((r, i) => (
              <p key={i}>
                {date(r.created_at)} · {actions[String(r.action)]} ·{" "}
                {String(r.reason)} · {String(r.actor_id)}
              </p>
            ))
          ) : (
            <p>조치 이력이 없습니다.</p>
          )}
          <Link href="/admin/users">회원 목록</Link>
        </section>
      )}
    </main>
  );
}
