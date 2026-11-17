import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import {
  funnel,
  rangeStartUtc,
  RANGES,
  RANGE_LABEL,
  toRange,
  topClicks,
  topContent,
  topPages,
  topSearches,
  visitorStats,
  type Range,
} from "@/lib/admin-insights";
import styles from "../../admin.module.css";

export const metadata = { title: "인사이트 · 어드민" };

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function InsightsPage(props: PageProps<"/admin/insights">) {
  return (
    <section className={styles.console}>
      <h1 className={styles.title}>인사이트</h1>
      <Suspense fallback={<p className={styles.muted}>불러오는 중…</p>}>
        <Insights searchParams={props.searchParams} />
      </Suspense>
    </section>
  );
}

function Bars({ rows }: { rows: { label: string; value: number; sub?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className={styles.muted}>데이터 없음</p>;
  return (
    <div>
      {rows.map((r) => (
        <div key={r.label} className={styles.barRow}>
          <span className={styles.barLabel} title={r.label}>
            {r.label}
          </span>
          <span className={styles.number}>{r.sub ?? r.value.toLocaleString()}</span>
          <span className={styles.barTrack}>
            <span className={styles.barFill} style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

async function Insights({ searchParams }: { searchParams: PageProps<"/admin/insights">["searchParams"] }) {
  await requireAdmin();
  const range: Range = toRange(one((await searchParams).range));
  const start = rangeStartUtc(range, new Date());

  const [visitors, pages, clicks, searches, content, fn] = await Promise.all([
    visitorStats(start),
    topPages(start),
    topClicks(start),
    topSearches(start),
    topContent(start),
    funnel(start),
  ]);

  const dwell = (ms: number) => (ms >= 1000 ? `${Math.round(ms / 1000)}s` : `${ms}ms`);

  return (
    <>
      <nav className={styles.rangeTabs} aria-label="기간">
        {RANGES.map((r) => (
          <Link key={r} href={`/admin/insights?range=${r}`} aria-current={r === range ? "true" : undefined}>
            {RANGE_LABEL[r]}
          </Link>
        ))}
      </nav>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>방문자</h2>
        <div className={styles.cards}>
          <div className={styles.card}>
            <span className={styles.cardNum}>{visitors.unique.toLocaleString()}</span>
            <span className={styles.cardLabel}>순방문자</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardNum}>{visitors.newVisitors.toLocaleString()}</span>
            <span className={styles.cardLabel}>신규</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardNum}>{visitors.returning.toLocaleString()}</span>
            <span className={styles.cardLabel}>재방문</span>
          </div>
        </div>
        {visitors.daily.length > 0 && (
          <Bars rows={visitors.daily.map((d) => ({ label: d.day, value: d.visitors }))} />
        )}
      </section>

      <div className={styles.twocol}>
        <section className={styles.section}>
          <h2 className={styles.subtitle}>체류 TOP 페이지</h2>
          <Bars
            rows={pages.map((p) => ({ label: p.path, value: p.views, sub: `${p.views}회 · ${dwell(p.avgDwellMs)}` }))}
          />
        </section>
        <section className={styles.section}>
          <h2 className={styles.subtitle}>클릭 히트</h2>
          <Bars rows={clicks.map((c) => ({ label: c.label, value: c.count }))} />
        </section>
      </div>

      <div className={styles.twocol}>
        <section className={styles.section}>
          <h2 className={styles.subtitle}>검색어 TOP (결과 있음)</h2>
          <Bars rows={searches.success.map((s) => ({ label: s.query, value: s.count }))} />
        </section>
        <section className={styles.section}>
          <h2 className={styles.subtitle}>검색어 TOP (결과 없음 · 수요)</h2>
          <Bars rows={searches.misses.map((s) => ({ label: s.query, value: s.count }))} />
        </section>
      </div>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>퍼널 (방문자)</h2>
        <div className={styles.funnel}>
          <div className={styles.funnelStep}>
            <span>검색</span>
            <span className={styles.number}>{fn.searchers.toLocaleString()}</span>
          </div>
          <div className={styles.funnelStep}>
            <span>카드 상세 열람</span>
            <span className={styles.number}>
              {fn.cardViewers.toLocaleString()} <span className={styles.muted}>({fn.searchToCard}%)</span>
            </span>
          </div>
          <div className={styles.funnelStep}>
            <span>원본 클릭</span>
            <span className={styles.number}>
              {fn.sourceClickers.toLocaleString()} <span className={styles.muted}>({fn.cardToSource}%)</span>
            </span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>인기 작품 (원본 클릭)</h2>
        <Bars
          rows={content.map((c) => ({ label: `${c.label} · @${c.artistName}`, value: c.clicks }))}
        />
      </section>
    </>
  );
}
