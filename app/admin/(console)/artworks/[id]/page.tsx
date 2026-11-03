import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtworkControls } from "@/components/admin/ArtworkControls";
import { requireAdmin } from "@/lib/admin";
import { getAdminArtwork, type ConsentEvent } from "@/lib/admin-data";
import { LINK_LABEL, REASON_LABEL, STATUS_LABEL } from "@/lib/admin-labels";
import { FORMAT_INFO } from "@/lib/formats";
import { cardPath } from "@/lib/search";
import styles from "../../../admin.module.css";

export const metadata = { title: "작품 상세 · 어드민" };

// design 11A 작품 상세: 요약 + 공개 상태·허락 근거 + 파일 + 철회(위험 영역) + consent_events 이력.
export default function ArtworkDetailPage(props: PageProps<"/admin/artworks/[id]">) {
  return (
    <Suspense fallback={<p className={styles.muted}>불러오는 중…</p>}>
      <Detail params={props.params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: PageProps<"/admin/artworks/[id]">["params"] }) {
  await requireAdmin();
  const { id } = await params;
  const a = await getAdminArtwork(id);
  if (!a) notFound();
  const cardNumber = `${a.setCode} ${a.collectorNumber}`;

  return (
    <article className={`${styles.console} ${styles.medium}`}>
      <header>
        <p className={styles.muted}>
          <Link href="/admin/artworks">← 작품 목록</Link>
        </p>
        <h1 className={styles.title}>
          {cardNumber} · @{a.artistName}
        </h1>
        <p className={styles.muted}>
          {a.cardName} · {FORMAT_INFO[a.format].label} · {STATUS_LABEL[a.status]}
          {a.printSizeVerified ? " · 치수 확인됨" : ""}
        </p>
        <p>
          <Link href={cardPath(a.setCode, a.collectorNumber)}>공개 카드 페이지 보기</Link>
        </p>
        {a.artistAccount && (
          <p>
            작가가 직접 올린 작품 · <Link href={`/artists/${a.artistAccount.handle}`}>작가 페이지 /artists/{a.artistAccount.handle}</Link>
          </p>
        )}
      </header>

      <section className={styles.section} aria-labelledby="source-heading">
        <h2 id="source-heading" className={styles.subtitle}>
          원본 글과 파일
        </h2>
        {a.sourceUrl ? (
          <p>
            <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer">
              {a.sourceUrl}
              <span className="visually-hidden">(새 탭)</span>
            </a>{" "}
            · {a.sourceVisibility === "members_only" ? "회원 전용" : "공개"} · 링크 {LINK_LABEL[a.linkStatus]}
            {a.linkCheckedAt && ` (${new Date(a.linkCheckedAt).toLocaleDateString("ko-KR")} 점검)`}
          </p>
        ) : (
          <p className={styles.muted}>원본 글 없음 (직접 받은 파일)</p>
        )}
        {a.files.length ? (
          <ul>
            {a.files.map((f) => (
              <li key={f.kind}>
                {f.kind === "original" ? "원본" : "미리보기"} · {f.mimeType} · {(f.sizeBytes / 1024 / 1024).toFixed(1)} MB
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>보관 중인 파일 없음</p>
        )}
      </section>

      <ArtworkControls
        id={a.id}
        cardNumber={cardNumber}
        status={a.status}
      />

      {a.reports.length > 0 && (
        <section className={styles.section} aria-labelledby="reports-heading">
          <h2 id="reports-heading" className={styles.subtitle}>
            이 작품의 신고
          </h2>
          <ul className={styles.timeline}>
            {a.reports.map((r) => (
              <li key={r.id}>
                {new Date(r.createdAt).toLocaleString("ko-KR")} · {REASON_LABEL[r.reason as keyof typeof REASON_LABEL] ?? r.reason} ·{" "}
                {r.status === "open" ? <Link href="/admin/reports">미처리</Link> : "처리됨"}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section} aria-labelledby="history-heading">
        <h2 id="history-heading" className={styles.subtitle}>
          변경 이력
        </h2>
        <ol className={styles.timeline}>
          {a.events.map((e) => (
            <li key={e.id}>
              <strong>{describe(e)}</strong>
              <br />
              <span className={styles.muted}>
                {new Date(e.createdAt).toLocaleString("ko-KR")} · {e.actor}
                {e.reason ? ` · ${e.reason}` : ""}
                {e.evidencePath && (
                  <>
                    {" · "}
                    {/* 어드민 전용 라우트가 짧은 서명 URL로 보낸다. 경로는 화면에 내보내지 않는다. */}
                    <a href={`/api/admin/evidence/${e.id}`} target="_blank" rel="noopener noreferrer">
                      근거 보기<span className="visually-hidden">(새 탭)</span>
                    </a>
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}

function describe(e: ConsentEvent): string {
  const status = (v: Record<string, unknown> | null) => STATUS_LABEL[v?.status as keyof typeof STATUS_LABEL] ?? "";
  if (e.kind === "created") return "등록";
  if (e.kind === "status") return `상태 ${status(e.before)} → ${status(e.after)}`;
  return "허락 근거 추가";
}
