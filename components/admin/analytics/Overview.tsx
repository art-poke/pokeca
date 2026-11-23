import { Activity, UserPlus, UsersRound, Eye } from "lucide-react";
import { analyticsLabel } from "@/lib/analytics/taxonomy";
import {
  audience,
  dateLabel,
  insights,
  metrics,
  period,
  retention,
  serviceMetrics,
  trends,
  type Filters,
} from "@/lib/analytics/report";
import { Panel, MetricCard, MetricList, Cohorts } from "./Panels";
import { TrendChart, ChannelChart } from "./Charts";
import { detailUrl, num, pct, signed } from "./navigation";
import { ReportControls } from "./ReportControls";
import s from "./dashboard.module.css";

export async function Overview({ q }: { q: Filters }) {
  const p = period(q),
    day = 86400000;
  const [
    today,
    yesterday,
    week,
    current,
    previous,
    series,
    data,
    segments,
    service,
    cohorts,
  ] = await Promise.all([
    metrics(p.today, p.now),
    metrics(new Date(+p.today - day), new Date(+p.now - day)),
    metrics(new Date(+p.today - 7 * day), new Date(+p.now - 7 * day)),
    metrics(p.start, p.end),
    metrics(p.previousStart, p.previousEnd),
    trends(p),
    insights(p.start, p.end),
    audience(p.start, p.end),
    serviceMetrics(p.start, p.end),
    retention(p.start, p.end),
  ]);
  const rows = series.toReversed().map((r) => ({
    ...r,
    visitors: r.covered || r.hasViews ? r.visitors : null,
    active: r.covered || r.active > 0 ? r.active : null,
  }));
  const count = (x: number, covered: boolean) =>
    covered ? num(x) + "명" : "미수집";
  const oauth = service.providers.reduce(
    (a, b) => ({
      starts: a.starts + b.starts,
      success: a.success + b.success,
      joins: a.joins + b.signups,
    }),
    { starts: 0, success: 0, joins: 0 },
  );
  const link = (key: Parameters<typeof detailUrl>[0]) => detailUrl(key, q);
  return (
    <main className={s.dashboard}>
      <header className={s.pageHead}>
        <div>
          <h1>운영 대시보드</h1>
          <p>
            {dateLabel(p.now).replaceAll("-", ". ")} ·{" "}
            {p.now.toLocaleTimeString("ko-KR", {
              timeZone: "Asia/Seoul",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            KST 기준
          </p>
        </div>
        <ReportControls path="/admin" p={p} q={q} />
      </header>
      <div className={s.metrics}>
        <MetricCard
          icon={Eye}
          color="#6fd8b2"
          title="오늘 방문자"
          value={today.covered || today.hasViews ? today.visitors : null}
          description={
            "동시간 · 어제 " +
            (yesterday.covered || yesterday.hasViews
              ? signed(today.visitors - yesterday.visitors) + "명"
              : "미수집") +
            " / 전주 " +
            (week.covered || week.hasViews
              ? signed(today.visitors - week.visitors) + "명"
              : "미수집")
          }
          href={detailUrl("traffic", { range: "today" })}
        />
        <MetricCard
          icon={Activity}
          color="#95a8ef"
          title="기간 활동 방문자"
          value={current.covered || current.active > 0 ? current.active : null}
          description={
            previous.covered || previous.active > 0
              ? "이전 기간 대비 " +
                signed(current.active - previous.active) +
                "명"
              : "이전 기간 미수집"
          }
          href={link("activity")}
        />
        <MetricCard
          icon={UserPlus}
          color="#f2b273"
          title="기간 신규 가입"
          value={current.joined}
          description={
            "이전 기간 대비 " + signed(current.joined - previous.joined) + "명"
          }
          href={link("growth")}
        />
        <MetricCard
          icon={UsersRound}
          color="#d391c3"
          title="기간 말 전체 회원"
          value={current.total}
          description={
            "선택 기간 회원 순증 " +
            signed(current.joined - current.left_count) +
            "명"
          }
          href={link("growth")}
        />
      </div>
      <div className={s.mainGrid}>
        <Panel
          title="방문 트래픽"
          href={link("traffic")}
          meta={p.unit === "month" ? "월별" : "일별"}
        >
          <TrendChart
            rows={rows}
            series={[
              { key: "visitors", name: "순방문자", color: "#6fd8b2" },
              { key: "active", name: "활동 방문자", color: "#95a8ef" },
            ]}
          />
          <div className={s.footStats}>
            <span>
              기간 순방문{" "}
              <b>
                {count(current.visitors, current.covered || current.hasViews)}
              </b>
            </span>
            <span>
              재방문율{" "}
              <b>{pct(segments.repeat.returning, segments.repeat.people)}</b>
            </span>
          </div>
        </Panel>
        <Panel title="유입 채널" href={link("channels")} meta="세션 기준">
          <ChannelChart rows={data.channels} />
        </Panel>
      </div>
      <div className={s.equalGrid}>
        <Panel title="회원 성장" href={link("growth")}>
          <TrendChart
            bars
            rows={rows}
            series={[
              { key: "joined", name: "신규 가입", color: "#f2b273" },
              { key: "lost", name: "탈퇴", color: "#8694aa" },
            ]}
          />
        </Panel>
        <Panel title="가입 전환" href={link("conversion")} meta="소셜 인증">
          <strong className={s.bigStat}>
            {pct(oauth.joins, oauth.starts)}
            <small>인증 시도 → 신규 가입</small>
          </strong>
          <MetricList
            unit="회"
            rows={[
              { name: "인증 시도", value: oauth.starts },
              { name: "인증 성공", value: oauth.success },
              { name: "신규 가입", value: oauth.joins, unit: "명" },
            ]}
          />
        </Panel>
      </div>
      <div className={s.equalGrid}>
        <Panel
          title="회원 리텐션"
          href={link("retention")}
          meta="최근 가입 코호트"
        >
          <Cohorts rows={cohorts.slice(0, 5)} now={+p.now} />
        </Panel>
        <Panel title="기능별 활동" href={link("activity")} meta="상위 5개">
          <MetricList
            unit="회"
            rows={data.outcomes
              .slice(0, 5)
              .map((r) => ({ name: analyticsLabel(r.type), value: r.n }))}
          />
        </Panel>
        <Panel title="검색 퍼널" href={link("search")}>
          <MetricList
            unit="세션"
            rows={[
              { name: "검색 세션", value: service.funnel.searched },
              { name: "카드 상세 도달", value: service.funnel.viewed },
              { name: "다운로드 발급", value: service.funnel.downloaded },
            ]}
          />
        </Panel>
        <Panel title="게임 참여" href={link("games")} meta="시작한 판">
          <MetricList
            unit="판"
            rows={service.games.map((r) => ({
              name: analyticsLabel(r.game),
              value: r.started,
            }))}
          />
        </Panel>
        <Panel title="도안 요청" href={link("requests")}>
          <MetricList
            unit="건"
            rows={[
              { name: "신규 요청", value: service.requests.created },
              { name: "해결", value: service.requests.resolved },
              { name: "기간 말 미해결", value: service.requests.pending },
            ]}
          />
        </Panel>
        <Panel
          title="오늘 방문 비교"
          href={detailUrl("traffic", { range: "today" })}
          meta="동일 시각"
        >
          <div className={s.statLines}>
            <p>
              오늘
              <b>{count(today.visitors, today.covered || today.hasViews)}</b>
            </p>
            <p>
              어제
              <b>
                {count(
                  yesterday.visitors,
                  yesterday.covered || yesterday.hasViews,
                )}
              </b>
            </p>
            <p>
              지난주 같은 요일
              <b>
                {count(week.visitors, week.covered || week.hasViews)}{" "}
                {week.covered || week.hasViews
                  ? "(" + signed(today.visitors - week.visitors) + "명)"
                  : ""}
              </b>
            </p>
          </div>
        </Panel>
      </div>
    </main>
  );
}
