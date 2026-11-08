import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { Suspense } from "react";
import { CardTile, CardTileGridSkeleton } from "@/components/card-tile";
import { SearchBar } from "@/components/search-bar";
import { SearchMissRequest } from "@/components/SearchMissRequest";
import { PokeballMark } from "@/components/ui/logo";
import { SearchResults } from "@/components/search-results";
import { randomCardsWithImages, recordSearch, searchCards, suggestCards } from "@/lib/cards";
import { cardPath } from "@/lib/search";
import { visitorId } from "@/lib/visitor";

export const metadata = { title: "카드 검색 · Extended Art Archive" };

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
    <div>
      <h1 className="visually-hidden">카드 검색</h1>
      <div className="mb-6 max-w-2xl">
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

  // 1건이면(그리고 다음 페이지가 없으면) 카드 상세로 바로 간다. 별칭으로 맞았으면 안내 줄 표시를 붙인다.
  if (result.hits.length === 1 && !result.hasMore) {
    const hit = result.hits[0];
    const from = hit.alias
      ? `?from=${hit.alias.lang}:${hit.alias.setCode}:${hit.alias.collectorNumber}`
      : "";
    redirect(cardPath(hit.setCode, hit.collectorNumber) + from);
  }

  if (result.hits.length === 0) {
    // 이름 검색이 빗나갔으면 오타 보정 후보("이거 찾으셨나요?")를 함께 제안한다.
    const suggestions = result.parsed.kind === "name" ? await suggestCards(query) : [];
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

        {suggestions.length > 0 && (
          <section className="mt-8" aria-labelledby="suggest-heading">
            <h2 id="suggest-heading" className="font-display text-lg font-bold text-foreground">
              혹시 이거 찾으셨나요?
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {suggestions.map((c) => (
                <li key={c.cardId}>
                  <CardTile card={c} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </SearchShell>
    );
  }

  return (
    <SearchShell query={query}>
      <SearchResults query={query} initial={{ hits: result.hits, hasMore: result.hasMore }} />
    </SearchShell>
  );
}

// 검색 랜딩(쿼리 없음): 큰 검색창 + 예시 + 카드 둘러보기.
function SearchLanding() {
  return (
    <div className="enter space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-background px-5 py-9 shadow-sm md:px-10 md:py-12">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-red-500" aria-hidden />
        <PokeballMark
          className="pointer-events-none absolute -right-12 -top-12 hidden size-60 opacity-[0.06] md:block"
          aria-hidden
        />
        <div className="relative">
          <h1 className="font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl md:text-4xl">
            카드 번호로 <span className="text-red-500">확장 아트</span> 찾기
          </h1>
          <p className="mt-3 max-w-lg text-sm text-muted-foreground md:text-base">
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

      <Suspense fallback={<BrowseSkeleton />}>
        <BrowseCards />
      </Suspense>
    </div>
  );
}

async function BrowseCards() {
  const cards = await randomCardsWithImages(12);
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby="browse-heading">
      <h2 id="browse-heading" className="font-display text-xl font-bold text-foreground md:text-2xl">
        카드 둘러보기
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">오늘의 카드 — 눌러서 확장 아트를 구경해 보세요.</p>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <li key={c.cardId}>
            <CardTile card={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const BrowseSkeleton = () => (
  <section aria-hidden>
    <div className="h-7 w-40 animate-pulse rounded-lg bg-gray-200" />
    <div className="mt-4">
      <CardTileGridSkeleton count={12} />
    </div>
  </section>
);

