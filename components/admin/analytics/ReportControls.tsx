import { CalendarDays, ChevronDown } from "lucide-react";
import Link from "next/link";
import { dateLabel, type Filters, type period } from "@/lib/analytics/report";
import { reportUrl } from "./navigation";
import s from "./dashboard.module.css";
type Option = { value: string; label: string };
export type Dimension = { key: string; label: string; options: Option[] };
export function ReportControls({
  path,
  q,
  p,
  dimensions = [],
  units = true,
}: {
  path: string;
  q: Filters;
  p: ReturnType<typeof period>;
  dimensions?: Dimension[];
  units?: boolean;
}) {
  const from = dateLabel(p.start),
    to = dateLabel(new Date(+p.end - 1));
  const range =
    typeof q.range === "string" ? q.range : q.from || q.to ? "custom" : "7d";
  const extras = new URLSearchParams();
  for (const d of dimensions)
    if (typeof q[d.key] === "string" && q[d.key])
      extras.set(d.key, String(q[d.key]));
  const preset = (r: string) =>
    reportUrl(path, { range: r, unit: q.unit }) +
    (extras.size ? "&" + extras : "");
  return (
    <div className={s.controlRow}>
      <nav className={s.segments} aria-label="조회 기간">
        {[
          ["today", "오늘"],
          ["yesterday", "어제"],
          ["7d", "7일"],
          ["30d", "30일"],
          ["month", "이번 달"],
        ].map(([r, title]) => (
          <Link
            key={r}
            href={preset(r)}
            aria-current={r === range ? "true" : undefined}
          >
            {title}
          </Link>
        ))}
      </nav>
      <details className={s.dateMenu} key={JSON.stringify(q)}>
        <summary>
          <CalendarDays size={15} />
          {from.replaceAll("-", ".")} –{" "}
          {(from.slice(0, 4) === to.slice(0, 4) ? to.slice(5) : to).replaceAll(
            "-",
            ".",
          )}{" "}
          <ChevronDown size={13} />
        </summary>
        <form action={path}>
          <label>
            시작일
            <input type="date" name="from" defaultValue={from} required />
          </label>
          <label>
            종료일
            <input type="date" name="to" defaultValue={to} required />
          </label>
          {units && (
            <label>
              집계 단위
              <select name="unit" defaultValue={p.unit}>
                <option value="day">일별</option>
                <option value="month">월별</option>
              </select>
            </label>
          )}
          {Array.from(extras, ([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <button>기간 적용</button>
        </form>
      </details>
      {!!dimensions.length && (
        <form
          className={s.dimensionForm}
          action={path}
          key={path + JSON.stringify(q)}
        >
          {["range", "from", "to", "unit"].map(
            (key) =>
              typeof q[key] === "string" && (
                <input key={key} type="hidden" name={key} value={q[key]} />
              ),
          )}
          {dimensions.map((d) => (
            <label key={d.key}>
              {d.label}
              <select
                name={d.key}
                defaultValue={
                  typeof q[d.key] === "string" ? String(q[d.key]) : ""
                }
              >
                <option value="">전체</option>
                {extras.has(d.key) &&
                  !d.options.some((o) => o.value === extras.get(d.key)) && (
                    <option value={extras.get(d.key)!}>
                      {extras.get(d.key)} · 해당 기간 데이터 없음
                    </option>
                  )}
                {d.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button>필터 적용</button>
        </form>
      )}
    </div>
  );
}
