import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import {
  audience,
  insights,
  metrics,
  observedPeople,
  pageTraffic,
  period,
  requestFormats,
  retention,
  serviceMetrics,
  trends,
  dateLabel,
  type Filters,
} from "@/lib/analytics/report";
import { analyticsLabel as label, cleanQuery } from "@/lib/analytics/taxonomy";
import { MetricList, Cohorts, DataTable, Panel } from "./Panels";
import { ChannelChart, TrendChart } from "./Charts";
import { ReportControls, type Dimension } from "./ReportControls";
import {
  detailUrl,
  num,
  pct,
  reportUrl,
  signed,
  topics,
  type Topic,
} from "./navigation";
import s from "./dashboard.module.css";

const choice = (q: Filters, key: string) =>
  typeof q[key] === "string" ? q[key] : "";
const dim = (key: string, title: string, values: string[]): Dimension => ({
  key,
  label: title,
  options: [...new Set(values)].map((value) => ({
    value,
    label: label(value),
  })),
});
const providerDim = dim("provider", "로그인 방식", ["kakao", "google"]);
const matches = (value: string, filter: string) => !filter || value === filter;
type View = { dimensions: Dimension[]; content: React.ReactNode };
function peoplePage(q: Filters) {
  return Math.min(
    100000,
    Math.max(1, Number.parseInt(choice(q, "list"), 10) || 1),
  );
}
function peopleUrl(
  topic: "traffic" | "search",
  q: Filters,
  term: string,
  list = 1,
) {
  const url = new URL(detailUrl(topic, q), "http://localhost");
  for (const key of ["page", "result"]) {
    if (choice(q, key)) url.searchParams.set(key, choice(q, key));
  }
  if (term) url.searchParams.set("term", term);
  if (list > 1) url.searchParams.set("list", String(list));
  return url.pathname + url.search + "#observed-people";
}
function PeoplePanel({
  title,
  people,
  page,
  link,
  countLabel,
}: {
  title: string;
  people: Awaited<ReturnType<typeof observedPeople>>;
  page: number;
  link: (page: number) => string;
  countLabel: string;
}) {
  return (
    <div id="observed-people">
      <Panel title={title}>
        <DataTable
          headers={[
            "회원",
            "소셜 이름",
            "로그인",
            countLabel,
            "최근 시각 (KST)",
          ]}
          rows={people.slice(0, 30).map((r) => [
            r.id ? (
              <Link className={s.reportLink} href={"/admin/users?id=" + r.id}>
                {r.display_name || r.social_name || "회원 상세"}
              </Link>
            ) : (
              "회원 연결 없음"
            ),
            r.id ? r.social_name || "미제공" : "—",
            r.provider ? label(r.provider) : "—",
            r.n,
            new Date(r.last_seen).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
            }),
          ])}
        />
        {(page > 1 || people.length > 30) && (
          <nav className={s.footStats} aria-label="방문·검색 회원 목록">
            {page > 1 && (
              <Link className={s.reportLink} href={link(page - 1)}>
                이전
              </Link>
            )}
            {people.length > 30 && (
              <Link className={s.reportLink} href={link(page + 1)}>
                다음
              </Link>
            )}
          </nav>
        )}
        <p className={s.note}>
          비로그인 및 회원 식별 정보가 없는 과거 기록은 ‘회원 연결 없음’으로
          합산합니다.
        </p>
      </Panel>
    </div>
  );
}

async function trafficReport(
  p: ReturnType<typeof period>,
  q: Filters,
): Promise<View> {
  const page = choice(q, "page");
  const list = peoplePage(q);
  const [traffic, data, buckets, visits, people] = await Promise.all([
    pageTraffic(p, page),
    insights(p.start, p.end),
    trends(p),
    audience(p.start, p.end),
    observedPeople(p.start, p.end, { type: "page_view", page }, list),
  ]);
  const byDate = new Map(traffic.series.map((r) => [r.label, r]));
  const rows = buckets.toReversed().map((r) => ({
    label: r.label,
    people: byDate.get(r.label)?.people ?? (r.covered ? 0 : null),
    views: byDate.get(r.label)?.views ?? (r.covered ? 0 : null),
    active: r.covered || r.active > 0 ? r.active : null,
  }));
  const covered = traffic.total.views > 0 || buckets.some((r) => r.covered);
  return {
    dimensions: [
      dim(
        "page",
        "페이지",
        data.traffic.map((r) => r.page),
      ),
    ],
    content: (
      <>
        <Panel
          title="페이지 방문 추이"
          meta={
            covered
              ? num(traffic.total.people) +
                "명 · " +
                num(traffic.total.views) +
                "회 조회"
              : "미수집"
          }
        >
          <TrendChart
            rows={rows}
            series={[
              { key: "people", name: "순방문자", color: "#6fd8b2" },
              page
                ? { key: "views", name: "페이지 조회", color: "#95a8ef" }
                : { key: "active", name: "활동 방문자", color: "#95a8ef" },
            ]}
          />
        </Panel>
        <PeoplePanel
          title={q.range === "today" ? "오늘 방문자" : "기간 방문자"}
          people={people}
          page={list}
          link={(n) => peopleUrl("traffic", q, "", n)}
          countLabel="페이지 조회"
        />
        <Panel title={p.unit === "month" ? "월별 방문 내역" : "일별 방문 내역"}>
          <DataTable
            headers={["기간", "순방문자", page ? "페이지 조회" : "활동 방문자"]}
            rows={rows
              .toReversed()
              .map((r) => [
                r.label,
                r.people ?? "—",
                (page ? r.views : r.active) ?? "—",
              ])}
          />
        </Panel>
        <Panel title="페이지별 방문">
          <DataTable
            headers={["페이지", "조회 수", "순방문자"]}
            rows={data.traffic
              .filter((r) => matches(r.page, page))
              .map((r) => [label(r.page), r.views, r.people])}
          />
        </Panel>
        {!page && (
          <p className={s.note}>
            새 계측 시작 {dateLabel(new Date(visits.repeat.since))} · 이전
            날짜는 관측된 기록만 표시 · 재방문 {visits.repeat.returning}명 /
            순방문 {visits.repeat.people}명
          </p>
        )}
      </>
    ),
  };
}

async function growthReport(
  p: ReturnType<typeof period>,
  q: Filters,
): Promise<View> {
  const provider = choice(q, "provider");
  const rows = (await trends(p, provider)).toReversed();
  return {
    dimensions: [providerDim],
    content: (
      <>
        <Panel title="전체 회원 추이">
          <TrendChart
            rows={rows}
            series={[
              { key: "total", name: "기간 말 전체 회원", color: "#d391c3" },
            ]}
          />
        </Panel>
        <Panel title="가입과 탈퇴">
          <DataTable
            headers={["기간", "신규 가입", "탈퇴", "순증", "전체 회원"]}
            rows={rows
              .toReversed()
              .map((r) => [
                r.label,
                r.joined,
                r.lost,
                signed(r.joined - r.lost),
                r.total,
              ])}
          />
        </Panel>
      </>
    ),
  };
}

async function retentionReport(
  p: ReturnType<typeof period>,
  q: Filters,
): Promise<View> {
  const provider = choice(q, "provider");
  const rows = await retention(p.start, p.end, provider);
  return {
    dimensions: [providerDim],
    content: (
      <Panel title="가입일별 재활동률" meta="가입일 기준">
        <Cohorts rows={rows} now={+p.now} />
      </Panel>
    ),
  };
}

async function requestsReport(
  p: ReturnType<typeof period>,
  q: Filters,
): Promise<View> {
  const all = await requestFormats(p.start, p.end),
    rows = all.filter((r) => matches(r.format, choice(q, "format")));
  return {
    dimensions: [
      dim(
        "format",
        "규격",
        all.map((r) => r.format),
      ),
    ],
    content: (
      <Panel title="규격별 요청 처리">
        <DataTable
          headers={["규격", "신규 요청", "해결", "기간 말 미해결"]}
          rows={rows.map((r) => [r.format, r.created, r.resolved, r.pending])}
        />
      </Panel>
    ),
  };
}

async function gamesReport(
  p: ReturnType<typeof period>,
  q: Filters,
): Promise<View> {
  const { games } = await serviceMetrics(p.start, p.end);
  const rows = games.filter((r) => matches(r.game, choice(q, "game")));
  return {
    dimensions: [
      dim(
        "game",
        "게임",
        games.map((r) => r.game),
      ),
    ],
    content: (
      <Panel title="게임별 참여와 완주">
        <DataTable
          headers={["게임", "시작한 판", "완주", "완주율"]}
          rows={rows.map((r) => [
            label(r.game),
            r.started,
            r.finished,
            pct(r.finished, r.started),
          ])}
        />
      </Panel>
    ),
  };
}

async function channelsReport(
  p: ReturnType<typeof period>,
  q: Filters,
): Promise<View> {
  const data = await insights(p.start, p.end);
  const rows = data.channels.filter((r) =>
    matches(r.channel, choice(q, "channel")),
  );
  const total = data.channels.reduce((n, r) => n + r.n, 0);
  return {
    dimensions: [
      dim(
        "channel",
        "채널",
        data.channels.map((r) => r.channel),
      ),
    ],
    content: (
      <>
        <Panel title="유입 채널 구성" meta="선택 채널 기준">
          <ChannelChart rows={rows} />
        </Panel>
        <Panel title="채널별 세션">
          <DataTable
            headers={["유입 채널", "유입 세션", "전체 세션 대비"]}
            rows={rows.map((r) => [r.channel, r.n, pct(r.n, total)])}
          />
        </Panel>
      </>
    ),
  };
}

async function conversionReport(
  p: ReturnType<typeof period>,
  q: Filters,
): Promise<View> {
  const page = choice(q, "page");
  const data = await insights(p.start, p.end);
  const [service, segments] = await Promise.all([
    serviceMetrics(p.start, p.end),
    audience(p.start, p.end),
  ]);
  const action = choice(q, "action");
  const rows = data.conversion.filter(
    (r) => matches(r.page, page) && matches(r.action, action),
  );
  return {
    dimensions: [
      dim(
        "page",
        "출발 페이지",
        data.conversion.map((r) => r.page),
      ),
      dim(
        "action",
        "버튼",
        data.conversion.map((r) => r.action),
      ),
    ],
    content: (
      <>
        <Panel title="페이지·버튼별 가입 전환">
          <DataTable
            headers={[
              "출발 페이지",
              "버튼",
              "위치",
              "노출 세션",
              "클릭 세션",
              "인증 시도",
              "인증 성공",
              "신규 가입",
              "노출 → 가입",
            ]}
            rows={rows.map((r) => [
              label(r.page),
              label(r.action),
              label(r.place),
              r.shown,
              r.clicked,
              r.starts,
              r.ok,
              r.joins,
              pct(r.converted, r.shown),
            ])}
          />
        </Panel>
        {!action && (
          <Panel title="비회원 방문 페이지별 가입률">
            <DataTable
              headers={["페이지", "비로그인 세션", "가입 세션", "가입률"]}
              rows={segments.pages
                .filter((r) => matches(r.page, page))
                .map((r) => [
                  label(r.page),
                  r.sessions,
                  r.converted,
                  pct(r.converted, r.sessions),
                ])}
            />
          </Panel>
        )}
        {!page && !action && (
          <Panel title="소셜 인증">
            <DataTable
              headers={["공급자", "시도", "인증 성공", "성공률", "신규 가입"]}
              rows={service.providers.map((r) => [
                label(r.provider),
                r.starts,
                r.success,
                pct(r.success, r.starts),
                r.signups,
              ])}
            />
          </Panel>
        )}
      </>
    ),
  };
}

async function activityReport(
  p: ReturnType<typeof period>,
  q: Filters,
): Promise<View> {
  const data = await insights(p.start, p.end);
  const { outcomes } = data,
    selected = choice(q, "event");
  const rows = outcomes.filter((r) => matches(r.type, selected));
  const dau = (days: number) =>
    metrics(new Date(+p.today - (days - 1) * 86400000), p.now);
  const [daily, weekly, monthly, selectedPeriod] = await Promise.all([
    dau(1),
    dau(7),
    dau(30),
    metrics(p.start, p.end),
  ]);
  return {
    dimensions: [
      dim(
        "event",
        "활동 종류",
        outcomes.map((r) => r.type),
      ),
    ],
    content: (
      <>
        {!selected && (
          <Panel title="활동 사용자">
            <DataTable
              headers={[
                "기간 활동 방문자",
                "기간 활동 회원",
                "오늘 활동 회원",
                "최근 7일 활동 회원",
                "최근 30일 활동 회원",
              ]}
              rows={[
                [
                  selectedPeriod.covered || selectedPeriod.active > 0
                    ? selectedPeriod.active
                    : "—",
                  selectedPeriod.covered || selectedPeriod.logged > 0
                    ? selectedPeriod.logged
                    : "—",
                  daily.covered || daily.logged > 0 ? daily.logged : "—",
                  weekly.covered || weekly.logged > 0 ? weekly.logged : "—",
                  monthly.covered || monthly.logged > 0 ? monthly.logged : "—",
                ],
              ]}
            />
          </Panel>
        )}
        <Panel title="기능별 활동 횟수">
          <MetricList
            unit="회"
            rows={rows.map((r) => ({ name: label(r.type), value: r.n }))}
          />
        </Panel>
      </>
    ),
  };
}

async function searchReport(
  p: ReturnType<typeof period>,
  q: Filters,
): Promise<View> {
  const term = cleanQuery(choice(q, "term"));
  const list = peoplePage(q);
  const [data, { funnel }, people] = await Promise.all([
    insights(p.start, p.end),
    serviceMetrics(p.start, p.end),
    term ? observedPeople(p.start, p.end, { type: "search", term }, list) : [],
  ]);
  const miss = choice(q, "result") === "miss";
  return {
    dimensions: [
      {
        key: "result",
        label: "검색어 결과",
        options: [{ value: "miss", label: "결과 없음 발생" }],
      },
    ],
    content: (
      <>
        {!miss && (
          <Panel
            title="검색에서 다운로드까지"
            meta={pct(funnel.downloaded, funnel.searched) + " 전환"}
          >
            <MetricList
              unit="세션"
              rows={[
                { name: "검색 세션", value: funnel.searched },
                { name: "카드 상세", value: funnel.viewed },
                { name: "다운로드", value: funnel.downloaded },
              ]}
            />
            <p className={s.note}>
              세션이 기록된 검색만 퍼널에 포함됩니다. 인기 검색어에는 이전 검색
              기록도 포함됩니다.
            </p>
          </Panel>
        )}
        <Panel title="인기 검색어" meta="검색량 상위 20개">
          <DataTable
            headers={["검색어", "검색", "결과 없음", "결과 없음 비율"]}
            rows={data.searches
              .filter((r) => !miss || r.miss > 0)
              .map((r) => [
                r.query ? (
                  <Link
                    className={s.reportLink}
                    prefetch={false}
                    href={peopleUrl("search", q, r.query)}
                  >
                    {r.query}
                  </Link>
                ) : (
                  "검색어 미수집"
                ),
                r.n,
                r.miss,
                pct(r.miss, r.n),
              ])}
          />
        </Panel>
        {term && (
          <PeoplePanel
            title={term + " 검색자"}
            people={people}
            page={list}
            link={(n) => peopleUrl("search", q, term, n)}
            countLabel="검색 횟수"
          />
        )}
      </>
    ),
  };
}

const reports = {
  traffic: trafficReport,
  growth: growthReport,
  retention: retentionReport,
  requests: requestsReport,
  games: gamesReport,
  channels: channelsReport,
  conversion: conversionReport,
  activity: activityReport,
  search: searchReport,
} satisfies Record<
  Topic,
  (p: ReturnType<typeof period>, q: Filters) => Promise<View>
>;

export async function DetailReport({ topic, q }: { topic: Topic; q: Filters }) {
  const p = period(q),
    path = "/admin/insights/" + topic;
  const { dimensions, content } = await reports[topic](p, q);
  return (
    <main className={s.dashboard}>
      <Link className={s.back} href={reportUrl("/admin", q)}>
        <ArrowLeft size={15} /> 대시보드
      </Link>
      <header className={s.pageHead}>
        <div>
          <h1>{topics[topic]}</h1>
          <p>
            {dateLabel(p.start)} — {dateLabel(new Date(+p.end - 1))} · 한국 시간
          </p>
        </div>
      </header>
      <ReportControls
        dimensions={dimensions}
        path={path}
        p={p}
        q={q}
        units={topic === "traffic" || topic === "growth"}
      />
      {content}
    </main>
  );
}

export function InsightIndex({ q }: { q: Filters }) {
  return (
    <main className={s.dashboard}>
      <header className={s.pageHead}>
        <h1>마케팅 인사이트</h1>
      </header>
      <div className={s.directory}>
        {(Object.keys(topics) as Topic[]).map((key) => (
          <Link key={key} href={detailUrl(key, q)}>
            <b>{topics[key]}</b>
            <ArrowUpRight size={17} />
          </Link>
        ))}
      </div>
    </main>
  );
}
