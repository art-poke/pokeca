import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { num, pct } from "./navigation";
import s from "./dashboard.module.css";

export function Panel({
  title,
  href,
  meta,
  children,
}: {
  title: string;
  href?: string;
  meta?: string;
  children: React.ReactNode;
}) {
  const content = (
    <>
      <div className={s.panelHead}>
        <h2>{title}</h2>
        <span>
          {meta}
          {href && <ArrowUpRight size={16} />}
        </span>
      </div>
      {children}
    </>
  );
  return href ? (
    <Link
      prefetch={false}
      className={s.panel}
      href={href}
      aria-label={title + " 상세 보기"}
    >
      {content}
    </Link>
  ) : (
    <section className={s.panel}>{content}</section>
  );
}
export function MetricCard({
  title,
  value,
  description,
  href,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | null;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <Link prefetch={false} className={s.metric} href={href}>
      <span className={s.metricLabel}>
        <i style={{ color }}>
          <Icon size={17} />
        </i>
        {title}
        <ArrowUpRight size={14} />
      </span>
      <strong>
        {value === null ? "—" : num(value)}
        <small>명</small>
      </strong>
      <span className={s.note}>{description}</span>
    </Link>
  );
}
export function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  if (!rows.length)
    return <p className={s.empty}>선택한 조건에 해당하는 데이터가 없습니다.</p>;
  return (
    <div className={s.tableScroll}>
      <table className={s.table}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j}>{typeof v === "number" ? num(v) : v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function MetricList({
  rows,
  unit,
}: {
  rows: { name: string; value: number; unit?: string }[];
  unit: string;
}) {
  if (!rows.length) return <p className={s.empty}>집계된 데이터가 없습니다.</p>;
  return (
    <dl className={s.metricList}>
      {rows.map((row) => (
        <div key={row.name}>
          <dt>{row.name}</dt>
          <dd>{num(row.value)}<small>{row.unit ?? unit}</small></dd>
        </div>
      ))}
    </dl>
  );
}
export function Cohorts({
  rows,
  now,
  days = [1, 7, 30],
}: {
  rows: { cohort: string; n: number; d1: number; d7: number; d30: number }[];
  now: number;
  days?: readonly (1 | 7 | 30)[];
}) {
  return (
    <DataTable
      headers={["가입일", "가입자", ...days.map((d) => "D" + d)]}
      rows={rows.map((r) => [
        r.cohort,
        r.n,
        ...days.map((d) => {
          const ready =
            +new Date(r.cohort + "T00:00:00+09:00") + (d + 1) * 86400000 <= now;
          const n = r[`d${d}`];
          return ready ? (
            <span
              className={s.heat}
              title={n + "명 / " + r.n + "명"}
              style={{
                background: `rgba(61,193,153,${0.09 + (0.42 * n) / Math.max(r.n, 1)})`,
              }}
            >
              {pct(n, r.n)}
            </span>
          ) : (
            <span className={s.muted}>관찰 중</span>
          );
        }),
      ])}
    />
  );
}
