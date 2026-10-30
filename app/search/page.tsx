import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { Suspense } from "react";
import { SearchBar } from "@/components/search-bar";
import { SearchMissRequest } from "@/components/SearchMissRequest";
import { Badge } from "@/components/ui/badge";
import { PokeballMark } from "@/components/ui/logo";
import { recentArtworkCards, recordSearch, searchCards, type CardHit } from "@/lib/cards";
import { cardPath } from "@/lib/search";
import { visitorId } from "@/lib/visitor";

export const metadata = { title: "카드 검색 · 확장 아트 아카이브" };

const EXAMPLES = ["리자몽", "피카츄", "이상해씨", "sv2a 201/165"];

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <Suspense fallback={<SearchShell query="" />}>
      <Results searchParams={props.searchParams} />
    </Suspense>
  );
}

function SearchShell({ query, children }: { query: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="visually-hidden">카드 검색</h1>
      <div className="mb-6">
        <SearchBar variant="hero" defaultValue={query} />
      </div>
      <div aria-live="polite">{children}</div>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 100) ?? "";
  if (!query.trim()) return <SearchLanding />;

  const result = await searchCards(query);
  const visitor = await visitorId();
  after(() => recordSearch(query, result, visitor).catch((e) => console.error("recordSearch", e)));

  // 1건이면 카드 상세로 바로 간다. 별칭으로 맞았으면 안내 줄을 위해 표시를 붙인다.
  if (result.hits.length === 1) {
    const hit = result.hits[0];
    const from = hit.alias
      ? `?from=${hit.alias.lang}:${hit.alias.setCode}:${hit.alias.collectorNumber}`
      : "";
    redirect(cardPath(hit.setCode, hit.collectorNumber) + from);
  }

  if (result.hits.length === 0) {
    return (
      <SearchShell query={query}>
        <div className="rounded-2xl border border-border bg-background p-6 text-center md:p-10">
          <h2 className="font-display text-lg font-bold text-foreground md:text-xl">
            ‘{query}’에 맞는 카드를 못 찾았어요
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            세트 코드와 번호를 함께 넣어 보세요:{" "}
            <code className="tabular rounded bg-muted px-1.5 py-0.5 text-ink-700">sv2a 201/165</code>{" "}
            또는{" "}
            <code className="tabular rounded bg-muted px-1.5 py-0.5 text-ink-700">sv2a-201</code>
          </p>
          <div className="mt-5">
            <SearchMissRequest
              query={query}
              label={result.parsed.kind === "name" ? "이 카드 찾기 요청" : "이 번호로 찾기 요청"}
            />
          </div>
        </div>
      </SearchShell>
    );
  }

  return (
    <SearchShell query={query}>
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
        카드 {result.hits.length}장
      </h2>
      <CandidateList hits={result.hits} />
    </SearchShell>
  );
}

// 검색 랜딩(쿼리 없음): 큰 검색창 + 예시 + 최근 등록 카드.
function SearchLanding() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-background px-6 py-10 shadow-sm md:px-10 md:py-12">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-primary" aria-hidden />
        <PokeballMark
          className="pointer-events-none absolute -right-12 -top-12 hidden size-60 opacity-[0.06] md:block"
          aria-hidden
        />
        <div className="relative">
          <h1 className="font-display text-3xl font-bold leading-tight text-foreground md:text-4xl">
            카드 번호로 <span className="text-primary">확장 아트</span> 찾기
          </h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            가지고 있는 카드 번호만 입력하면, 그 카드에 맞는 확장 아트 도안을 모아서 보여드려요.
          </p>
          <div className="mt-6 max-w-xl">
            <SearchBar variant="hero" />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">인기 검색</span>
            {EXAMPLES.map((q) => (
              <Link
                key={q}
                href={`/search?q=${encodeURIComponent(q)}`}
                className="tabular rounded-full border border-border bg-background px-3 py-1 text-sm font-medium text-ink-700 transition-colors hover:border-primary hover:text-primary"
              >
                {q}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Suspense fallback={<RecentCardsSkeleton />}>
        <RecentCards />
      </Suspense>
    </div>
  );
}

async function RecentCards() {
  const cards = await recentArtworkCards(8);
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby="recent-heading">
      <h2 id="recent-heading" className="font-display text-xl font-bold text-foreground md:text-2xl">
        최근 도안이 등록된 카드
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <li key={`${c.setCode}-${c.collectorNumber}`}>
            <Link
              href={cardPath(c.setCode, c.collectorNumber)}
              className="group flex flex-col gap-2.5 rounded-2xl border border-border bg-background p-2.5 transition-shadow hover:shadow-md"
            >
              <div className="relative flex aspect-[63/88] items-center justify-center overflow-hidden rounded-xl border border-border bg-gradient-to-br from-gray-50 to-gray-200">
                <PokeballMark
                  className="pointer-events-none absolute -bottom-4 -right-4 size-20 opacity-[0.1]"
                  aria-hidden
                />
                <span className="tabular text-center text-sm font-bold leading-snug text-ink-600">
                  {c.setCode}
                  <br />
                  {c.collectorNumber}
                </span>
              </div>
              <div className="px-0.5 pb-0.5">
                <div className="tabular text-sm font-bold text-foreground">
                  {c.setCode} {c.collectorNumber}
                </div>
                <div className="truncate text-sm text-muted-foreground group-hover:text-foreground">
                  {c.nameKo}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const RecentCardsSkeleton = () => (
  <section aria-hidden>
    <div className="h-7 w-48 animate-pulse rounded-lg bg-gray-200" />
    <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="rounded-2xl border border-border bg-background p-2.5">
          <div className="aspect-[63/88] animate-pulse rounded-xl bg-gray-100" />
          <div className="mt-2.5 h-4 w-20 animate-pulse rounded bg-gray-100" />
          <div className="mt-1.5 h-4 w-24 animate-pulse rounded bg-gray-100" />
        </li>
      ))}
    </ul>
  </section>
);

// 카드당 한 줄. 도안 많은 순, 같으면 최신 확장팩 순(DB가 정렬).
function CandidateList({ hits }: { hits: CardHit[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
      {hits.map((hit) => (
        <li key={hit.cardId}>
          <Link
            href={cardPath(hit.setCode, hit.collectorNumber)}
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold text-foreground">{hit.nameKo}</span>
                {hit.rarity && <Badge variant="outline">{hit.rarity}</Badge>}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="tabular font-medium text-ink-600">
                  {hit.setCode} {hit.collectorNumber}
                </span>
                <span aria-hidden>·</span>
                <span className="truncate">{hit.setName}</span>
              </div>
            </div>
            {hit.artworkCount === 0 ? (
              <Badge variant="muted">도안 없음</Badge>
            ) : (
              <Badge variant="primary">도안 {hit.artworkCount}</Badge>
            )}
            <ChevronRight className="size-5 shrink-0 text-gray-300" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
