"use client";

import { useId } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { num, pct } from "./navigation";
import s from "./dashboard.module.css";

export const palette = [
  "#6fd8b2",
  "#f2b273",
  "#95a8ef",
  "#d391c3",
  "#6abed4",
  "#a6afbc",
];
export type ChartRow = {
  label: string;
  [key: string]: string | number | boolean | null;
};
export type Series = { key: string; name: string; color: string };
const tooltip = {
  background: "#20272e",
  border: "1px solid #424a54",
  borderRadius: 8,
  color: "#f3f5f7",
  fontSize: 12,
};
export function TrendChart({
  rows,
  series,
  bars = false,
}: {
  rows: ChartRow[];
  series: Series[];
  bars?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  if (
    !rows.some((row) =>
      series.some((field) => typeof row[field.key] === "number"),
    )
  )
    return <p className={s.empty}>선택한 기간에 관측된 데이터가 없습니다.</p>;
  return (
    <div className={s.plot}>
      <div className={s.legend}>
        {series.map((f) => (
          <span key={f.key}>
            <i style={{ background: f.color }} />
            {f.name}
          </span>
        ))}
      </div>
      <div className={s.chartCanvas}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          initialDimension={{ width: 500, height: 180 }}
        >
          <ComposedChart
            data={rows}
            margin={{ top: 8, right: 14, bottom: 0, left: 0 }}
            accessibilityLayer
          >
            <defs>
              <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={series[0].color}
                  stopOpacity={0.23}
                />
                <stop
                  offset="100%"
                  stopColor={series[0].color}
                  stopOpacity={0.01}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#343b42"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#a6b0b8", fontSize: 11 }}
              minTickGap={24}
              tickMargin={9}
              tickFormatter={(v) =>
                String(v).length === 10
                  ? String(v).slice(5).replace("-", "/")
                  : String(v)
              }
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              width={38}
              tick={{ fill: "#a6b0b8", fontSize: 11 }}
              tickCount={4}
            />
            <Tooltip
              contentStyle={tooltip}
              labelStyle={{ color: "#fff" }}
              itemStyle={{ color: "#dde4e8" }}
              cursor={{ stroke: "#79848a" }}
            />
            {series.map((f, i) =>
              bars ? (
                <Bar
                  key={f.key}
                  dataKey={f.key}
                  name={f.name}
                  fill={f.color}
                  maxBarSize={30}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              ) : (
                <Area
                  key={f.key}
                  type="linear"
                  name={f.name}
                  dataKey={f.key}
                  stroke={f.color}
                  strokeWidth={2.6}
                  strokeDasharray={i ? "5 3" : undefined}
                  fill={i ? "none" : `url(#${id})`}
                  dot={rows.length === 1 ? { r: 4 } : false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
export function ChannelChart({
  rows,
}: {
  rows: { channel: string; n: number }[];
}) {
  const total = rows.reduce((n, v) => n + v.n, 0);
  if (!total)
    return <p className={s.empty}>선택한 기간에 유입 세션이 없습니다.</p>;
  const items = rows
    .slice(0, 4)
    .map((r, i) => ({ name: r.channel, value: r.n, fill: palette[i] }));
  if (rows.length > 4)
    items.push({
      name: "그 외 채널",
      value: rows.slice(4).reduce((n, r) => n + r.n, 0),
      fill: palette[4],
    });
  return (
    <div className={s.channel}>
      <div className={s.ring}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 148, height: 148 }}
        >
          <PieChart>
            <Pie
              data={items}
              dataKey="value"
              nameKey="name"
              innerRadius="70%"
              outerRadius="94%"
              paddingAngle={2}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            />
            <Tooltip contentStyle={tooltip} itemStyle={{ color: "#fff" }} />
          </PieChart>
        </ResponsiveContainer>
        <div>
          <b>{num(total)}</b>
          <small>유입 세션</small>
        </div>
      </div>
      <div className={s.channelList}>
        {items.map((r) => (
          <div key={r.name}>
            <i style={{ background: r.fill }} />
            <span>{r.name}</span>
            <b>{pct(r.value, total)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
