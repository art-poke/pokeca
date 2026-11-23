import { Suspense } from "react";
import Link from "next/link";
import { recordLinkCheck } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin";
import { listAdminArtworks, LINK_STATUSES, type ArtworkFilter, type LinkStatus } from "@/lib/admin-data";
import type { Status } from "@/lib/artworks";
import { LINK_LABEL, STATUS_LABEL } from "@/lib/admin-labels";
import { FORMAT_INFO } from "@/lib/formats";
import styles from "../../admin.module.css";

export const metadata = { title: "작품 · 어드민" };

// design 11A 작품 목록 + eng E6 수동 링크 점검. 점검 필요(7일 넘음·의심·미점검)가 맨 위.
export default function ArtworksPage(props: PageProps<"/admin/artworks">) {
  return (
    <section className={styles.console}>
      <h1 className={styles.title}>작품</h1>
      <Link href="/admin/artworks/new" className={styles.secondary}>작품 등록</Link>
      <Suspense fallback={<p className={styles.muted}>불러오는 중…</p>}>
        <ArtworkTable searchParams={props.searchParams} />
      </Suspense>
    </section>
  );
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function ArtworkTable({ searchParams }: { searchParams: PageProps<"/admin/artworks">["searchParams"] }) {
  await requireAdmin();
  const query = await searchParams;
  const status = one(query.status);
  const link = one(query.link);
  const filter: ArtworkFilter = {
    status: status && status in STATUS_LABEL ? (status as Status) : undefined,
    linkStatus: link && link in LINK_LABEL ? (link as LinkStatus) : undefined,
    needsCheck: one(query.check) === "1",
  };
  const rows = await listAdminArtworks(filter);

  return (
    <>
      <form className={styles.filters} role="search" aria-label="작품 거르기">
        <label className={styles.field}>
          <span>상태</span>
          <select name="status" defaultValue={filter.status ?? ""} className={styles.input}>
            <option value="">전체</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>링크 상태</span>
          <select name="link" defaultValue={filter.linkStatus ?? ""} className={styles.input}>
            <option value="">전체</option>
            {LINK_STATUSES.map((v) => (
              <option key={v} value={v}>
                {LINK_LABEL[v]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.check}>
          <input type="checkbox" name="check" value="1" defaultChecked={filter.needsCheck} />
          점검 필요만
        </label>
        <button type="submit" className={styles.secondary}>
          거르기
        </button>
      </form>

      <p className={styles.muted}>
        {rows.length}개 · 점검 필요 {rows.filter((r) => r.needsCheck).length}개
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">카드 번호</th>
              <th scope="col">작가</th>
              <th scope="col">규격</th>
              <th scope="col">상태</th>
              <th scope="col">링크 상태</th>
              <th scope="col">최근 점검</th>
              <th scope="col">점검 기록</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={styles.number}>
                  <Link href={`/admin/artworks/${r.id}`}>
                    {r.setCode} {r.collectorNumber}
                  </Link>
                </td>
                <td>@{r.artistName}</td>
                <td>{FORMAT_INFO[r.format].label}</td>
                <td>{STATUS_LABEL[r.status]}</td>
                <td>
                  {r.sourceUrl ? LINK_LABEL[r.linkStatus] : "원본 글 없음"}
                  {r.sourceVisibility === "members_only" ? " · 회원 전용" : ""}{" "}
                  {r.needsCheck && <span className={styles.flag}>점검 필요</span>}
                </td>
                <td>{r.linkCheckedAt ? new Date(r.linkCheckedAt).toLocaleDateString("ko-KR") : "—"}</td>
                <td>
                  {r.sourceUrl && r.status !== "withdrawn" ? (
                    <form action={recordLinkCheck} className={styles.row}>
                      <input type="hidden" name="id" value={r.id} />
                      <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
                        원본 열기 ↗<span className="visually-hidden">(새 탭)</span>
                      </a>
                      <select
                        name="linkStatus"
                        defaultValue={r.linkStatus === "unchecked" || r.linkStatus === "suspect" ? "ok" : r.linkStatus}
                        className={styles.input}
                        aria-label={`${r.setCode} ${r.collectorNumber} @${r.artistName} 링크 상태`}
                      >
                        <option value="ok">정상</option>
                        <option value="deleted">삭제됨</option>
                        <option value="no_access">권한 없음</option>
                      </select>
                      <button type="submit" className={styles.secondary}>
                        점검 완료
                      </button>
                    </form>
                  ) : (
                    <span className={styles.muted}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
