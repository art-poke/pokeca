import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { dashboardSummary, type WindowCounts } from "@/lib/admin-insights";
import styles from "../admin.module.css";

export const metadata = { title: "현황 · 어드민" };

export default function AdminHome() {
  return (
    <section className={styles.console}>
      <h1 className={styles.title}>현황</h1>
      <Suspense fallback={<p className={styles.muted}>불러오는 중…</p>}>
        <Dashboard />
      </Suspense>
    </section>
  );
}

const COUNT_LABELS: { key: keyof WindowCounts; label: string }[] = [
  { key: "visitors", label: "방문자" },
  { key: "members", label: "신규 회원" },
  { key: "artworks", label: "신규 작품" },
  { key: "posts", label: "커뮤니티 글" },
  { key: "comments", label: "댓글" },
  { key: "reviews", label: "리뷰" },
  { key: "gamePlays", label: "게임 플레이" },
];

function Cards({ counts }: { counts: WindowCounts }) {
  return (
    <div className={styles.cards}>
      {COUNT_LABELS.map(({ key, label }) => (
        <div key={key} className={styles.card}>
          <span className={styles.cardNum}>{counts[key].toLocaleString()}</span>
          <span className={styles.cardLabel}>{label}</span>
        </div>
      ))}
    </div>
  );
}

async function Dashboard() {
  await requireAdmin();
  const summary = await dashboardSummary();
  const { openReports, needsCheckArtworks, pendingRequests } = summary.alerts;

  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.subtitle}>경보</h2>
        <div className={styles.alerts}>
          <Link href="/admin/reports" className={`${styles.alert} ${openReports ? styles.alertOn : ""}`}>
            열린 신고 {openReports}
          </Link>
          <Link
            href="/admin/artworks?check=1"
            className={`${styles.alert} ${needsCheckArtworks ? styles.alertOn : ""}`}
          >
            점검 필요 작품 {needsCheckArtworks}
          </Link>
          <span className={`${styles.alert} ${pendingRequests ? styles.alertOn : ""}`}>
            대기 요청 {pendingRequests}
          </span>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>오늘</h2>
        <Cards counts={summary.today} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>최근 7일</h2>
        <Cards counts={summary.week} />
      </section>

      <section className={styles.section}>
        <p>
          <Link href="/admin/insights" className={styles.secondary}>
            행동·마케팅 인사이트 보기 →
          </Link>
        </p>
      </section>
    </>
  );
}
