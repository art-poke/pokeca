import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Comments } from "@/components/comments";
import { RowsSkeleton } from "@/components/skeletons";
import { StoryLikeButton, StoryShareButton } from "@/components/story-actions";
import { StoryViewCount } from "@/components/story-view-count";
import { storyCategoryLabels } from "@/domains/story/types";
import { currentMember } from "@/lib/artists";
import { listComments } from "@/lib/comments";
import { getStoryLikes } from "@/lib/story-likes";
import { meleeKrw, meleePrice, meleeStory } from "../melee-pokemon-scramble";
import { ponchoStory } from "../poncho-pikachu";
import { stories, usdToKrw } from "../stories";

type StoryPageProps = PageProps<"/stories/[slug]">;
type StoryImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  credit?: string;
  attribution?: { source: string; license: string; label: string };
};
type StorySectionData = {
  title: string;
  body: readonly string[];
  image?: StoryImage;
  additionalImage?: StoryImage;
  afterImage?: readonly string[];
  contents?: readonly (StoryImage & { caption: string; fullWidth?: boolean })[];
  note?: string;
};

export const dynamicParams = false;
const dollarFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const chartLimit = 4_000_000;

type PricePoint = {
  label: string;
  amount: number;
  won: string;
  krw?: number;
  venue?: string;
};

function PriceColumns({ points, limit = chartLimit }: { points: readonly PricePoint[]; limit?: number }) {
  const ticks = Array.from({ length: 5 }, (_, index) => {
    const value = (4 - index) * limit / 4 / 10000;
    return value ? `${value.toLocaleString("ko-KR")}만` : "0";
  });
  return (
    <div className="relative grid grid-cols-[max-content_minmax(0,1fr)] gap-x-2">
      <div className="relative col-start-2 row-start-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 flex h-44 flex-col justify-between border-l border-border"
        >
          {ticks.map((tick) => <div key={tick} className="border-t border-border" />)}
        </div>
        <ol className="flex">
          {points.map((point) => (
            <li key={point.label} className="relative min-w-0 flex-1 text-center">
              <div aria-hidden className="flex h-44 items-end justify-center">
                <div
                  className={point.venue === "SNKRDUNK" ? "w-[52%] max-w-20 rounded-t-md bg-[#7458a3]" : "w-[52%] max-w-20 rounded-t-md bg-[#2e6477]"}
                  style={{ height: `${(point.krw ?? point.amount * usdToKrw) / limit * 100}%` }}
                />
              </div>
              <div className="space-y-0.5 px-0.5 pt-2.5 text-[11px] leading-snug tabular-nums sm:text-sm">
                <p className="font-semibold">{point.label}</p>
                {point.venue && (
                  <p className="text-[10px] text-muted-foreground">
                    <span className="sm:hidden">{point.venue === "SNKRDUNK" ? "스니커덩크" : point.venue === "Fanatics Collect" ? "패너틱스" : point.venue}</span>
                    <span className="hidden sm:inline">{point.venue}</span>
                  </p>
                )}
                {point.krw !== undefined && (
                  <p className="font-bold sm:hidden">{Math.round(point.krw / 10_000).toLocaleString("ko-KR")}만</p>
                )}
                <p className={point.krw === undefined ? "break-keep font-bold" : "hidden font-bold sm:block"}>{point.won}</p>
                {point.krw === undefined && (
                  <p className="text-xs text-muted-foreground">{dollarFormat.format(point.amount)}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div aria-hidden className="relative col-start-1 row-start-1 h-44 text-right text-[10px] tabular-nums text-muted-foreground sm:text-xs">
        <span className="invisible">{ticks[0]}</span>
        {ticks.map((tick, index) => (
          <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${index * 25}%` }}>
            {tick}
          </span>
        ))}
      </div>
    </div>
  );
}

export function generateStaticParams() {
  return stories.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const story = stories.find((item) => item.slug === slug);
  if (!story) return {};
  const url = `/stories/${story.slug}`;
  const preview = {
    title: story.title,
    description: story.summary,
    images: [story.shareImage],
  };

  return {
    title: `${story.title} · 카드 이야기`,
    description: story.summary,
    alternates: { canonical: url },
    openGraph: {
      ...preview,
      type: "article",
      url,
      siteName: "Extended Art Archive",
      locale: "ko_KR",
    },
    twitter: { ...preview, card: "summary_large_image" },
  };
}

function StoryFigure({ image }: { image: StoryImage }) {
  return (
    <figure className="space-y-2 text-center">
      <Image
        src={image.src}
        width={image.width}
        height={image.height}
        alt={image.alt}
        unoptimized
        className="mx-auto block h-auto max-h-80 w-auto max-w-full rounded-xl border border-border object-contain"
      />
      {image.credit && (
        <figcaption className="text-xs leading-relaxed text-muted-foreground">{image.credit}</figcaption>
      )}
    </figure>
  );
}

function StorySection({ section }: { section: StorySectionData }) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold md:text-2xl">{section.title}</h2>
      {section.body.map((paragraph) => <p key={paragraph} className="text-base leading-[1.85]">{paragraph}</p>)}
      {section.image && <StoryFigure image={section.image} />}
      {section.additionalImage && <StoryFigure image={section.additionalImage} />}
      {section.afterImage?.map((paragraph) => <p key={paragraph} className="text-base leading-[1.85]">{paragraph}</p>)}
      {section.contents && (
        <div className="space-y-3">
          <h3 className="font-semibold">박스 안에 들어 있던 것들</h3>
          <ul className="grid items-start gap-4 sm:grid-cols-2">
            {section.contents.map((item) => (
              <li key={item.src} className={item.fullWidth ? "sm:col-span-2" : undefined}>
                <figure className="mx-auto w-fit space-y-2 text-center">
                  <Image src={item.src} width={item.width} height={item.height} alt={item.alt} unoptimized
                    className="block h-auto max-w-full rounded-lg border border-border" />
                  <figcaption className="text-sm font-medium">{item.caption}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
      )}
      {section.note && (
        <aside className="rounded-xl border-l-4 border-primary/40 bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">
          * {section.note}
        </aside>
      )}
    </section>
  );
}

async function StoryEngagement({ story }: { story: (typeof stories)[number] }) {
  const member = await currentMember();
  const userId = member?.userId ?? null;
  const [likes, comments] = await Promise.all([
    getStoryLikes(story.id, userId),
    listComments("story", story.id, userId),
  ]);

  return (
    <>
      <StoryLikeButton slug={story.slug} initial={likes} isMember={!!member} />
      <div className="w-full border-t border-border pt-5">
        <Comments target="story" targetId={story.id} comments={comments} canWrite={!!member} />
      </div>
    </>
  );
}

function VanGoghStoryBody({ story }: { story: Extract<(typeof stories)[number], { slug: "pikachu-with-grey-felt-hat" }> }) {
  const [marketStory, closingStory] = story.closingSections;
  return (
    <>
      <StoryFigure image={story.introImage} />
      <div className="grid gap-4 sm:grid-cols-2">
        <StoryFigure image={story.portrait} />
        <StoryFigure image={story.image} />
      </div>
      {story.sections.map((section) => <StorySection key={section.title} section={section} />)}
      <section aria-labelledby="story-sales" className="space-y-3">
        <h2 id="story-sales" className="font-display text-xl font-bold">같은 PSA 10, 세 번의 경매</h2>
        <p className="text-sm text-muted-foreground">막대는 낙찰가만 비교합니다. 배송비와 구매자 수수료는 아래에 따로 적었어요.</p>
        <StoryFigure image={story.auctionReaction} />
        <figure className="space-y-5 rounded-2xl border border-border bg-background p-4 sm:p-6">
          <figcaption className="text-sm font-semibold text-muted-foreground">낙찰가 비교 · 원화(원) · 오래된 거래부터</figcaption>
          <PriceColumns points={story.sales.map((sale) => ({ ...sale, label: sale.date }))} />
          <ul className="divide-y divide-border border-t border-border text-xs text-muted-foreground">
            {story.sales.map((sale) => (
              <li key={sale.date} className="flex flex-wrap gap-x-2 gap-y-1 py-2.5">
                <a href={sale.source.href} className="font-semibold text-foreground underline underline-offset-4 hover:text-primary">
                  {sale.date} · {sale.venue}
                </a>
                <span>{sale.note}</span>
              </li>
            ))}
          </ul>
        </figure>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        {story.marketComparisons.map((comparison) => (
          <figure key={comparison.title} className="space-y-4 rounded-2xl border border-border bg-background p-4">
            <figcaption>
              <p className="font-display text-lg font-bold">{comparison.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{comparison.context}</p>
            </figcaption>
            <PriceColumns points={comparison.values} />
          </figure>
        ))}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-xl border border-border bg-muted px-4 py-3 text-sm">
        <a href={story.rawMarket.source.href} className="font-semibold underline underline-offset-4">미감정 · 11월 13일 TCGplayer 시장 지표</a>
        <span className="tabular-nums"><strong>{story.rawMarket.won}</strong> · {dollarFormat.format(story.rawMarket.amount)}</span>
      </div>
      <StorySection section={marketStory} />
      <div className="grid items-center gap-4 rounded-2xl bg-[#172a32] p-5 text-white sm:grid-cols-[9rem_1fr] sm:p-6">
        <Image src={story.blackLabel.image.src} width={story.blackLabel.image.width} height={story.blackLabel.image.height} alt={story.blackLabel.image.alt} unoptimized
          className="mx-auto max-h-56 w-auto rounded-lg object-contain" />
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#ffdf9d]">BGS 10 블랙라벨</p>
          <strong className="block text-2xl leading-tight tabular-nums sm:text-3xl">{story.blackLabel.won}</strong>
          <p className="text-sm text-white/90">{dollarFormat.format(story.blackLabel.amount)} · 구매자 수수료 포함</p>
          <p className="text-sm text-white/80">2026.10.23 · Fanatics Collect · 입찰 33건</p>
          <a href={story.blackLabel.source.href} className="inline-block text-sm underline underline-offset-4">경매 결과와 인증번호 보기</a>
        </div>
      </div>
      <StorySection section={story.blackLabel.story} />
      <StorySection section={closingStory} />
    </>
  );
}

function MeleeStoryBody({ story }: { story: typeof meleeStory }) {
  const [game, box, prizes] = story.sections;

  return (
    <>
      <StoryFigure image={story.image} />
      <StorySection section={game} />
      <StorySection section={box} />
      <section aria-labelledby="melee-base-set" className="space-y-4">
        <h2 id="melee-base-set" className="font-display text-xl font-bold md:text-2xl">{story.baseSet.title}</h2>
        <p className="text-base leading-[1.85]">{story.baseSet.intro}</p>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
          {story.baseSet.cards.map((card) => (
            <li key={card.number}>
              <figure className="space-y-2 text-center">
                <Image
                  src={card.src}
                  alt={`일본판 난전 포켓몬 스크램블 ${card.name} ${card.number} 카드 앞면`}
                  width={248}
                  height={346}
                  unoptimized
                  className="mx-auto h-auto w-full rounded-md"
                />
                <figcaption>
                  <span className="block text-sm font-semibold">{card.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{card.number}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>
      <StorySection section={prizes} />
      <StorySection section={story.market} />
      <figure className="space-y-5 rounded-2xl border border-border bg-background p-3 sm:p-6">
        <figcaption className="text-sm font-semibold">일본판 피카츄 007/016 · PSA 10 · 판매 완료 금액 (원화)</figcaption>
        <PriceColumns limit={48_000_000} points={story.sales.map((sale) => ({
          amount: sale.amount,
          label: sale.date.slice(2).replaceAll("-", "."),
          venue: sale.venue,
          krw: meleeKrw(sale.amount, sale.currency),
          won: meleePrice(sale.amount, sale.currency),
        }))} />
        <ul className="divide-y divide-border border-t border-border text-xs text-muted-foreground">
          {story.sales.map((sale) => {
            const won = meleePrice(sale.amount, sale.currency);
            return (
              <li key={sale.date} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                <a href={sale.source.href} className="font-semibold text-foreground underline underline-offset-4">
                  {sale.date} · {sale.venue} · {sale.kind}
                </a>
                <span className="tabular-nums">{won}</span>
              </li>
            );
          })}
        </ul>
      </figure>
      <div className="grid grid-cols-2 gap-4">
        {story.gallery.map((image) => <StoryFigure key={image.src} image={image} />)}
      </div>
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold md:text-2xl">SNKRDUNK에서 뮤츠와 뮤도 찾아봤어요</h2>
        <p className="text-sm text-muted-foreground">일본판 한 장 기준 · PSA 10 판매 완료 사례와 11월 21일 확인한 최저 호가</p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {story.snkrdunk.map((row) => {
            const sold = meleePrice(row.psa10Sold, "JPY");
            const ask = meleePrice(row.psa10Ask, "JPY");
            return (
              <li key={row.number} className="space-y-3 rounded-xl border border-border p-4 tabular-nums">
                <a href={row.source.href} className="block font-semibold underline underline-offset-4">{row.card} {row.number}</a>
                <div>
                  <p className="text-xs text-muted-foreground">{row.psa10Date} 판매 완료</p>
                  <strong className="block">{sold}</strong>
                </div>
                <div className="border-t border-border pt-2 text-xs text-muted-foreground">
                  <p>판매 호가</p>
                  <p>{ask}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <StorySection section={story.closing} />
    </>
  );
}

function PonchoStoryBody({ story }: { story: typeof ponchoStory }) {
  return (
    <>
      <StoryFigure image={story.image} />
      {story.sections.map(({ cards, ...section }) => (
        <div key={section.title} className="space-y-5">
          <StorySection section={section} />
          <ul aria-label={`${section.title} 카드 목록`} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {cards.map((card) => (
              <li key={card.label}>
                <figure className="space-y-2 text-center">
                  <Image src={card.src} width={card.width} height={card.height} alt={card.alt} unoptimized
                    className="mx-auto block h-auto max-h-56 w-auto max-w-full rounded-lg object-contain sm:max-h-64" />
                  <figcaption>
                    <span className="block text-sm font-semibold">{card.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{card.label}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <StorySection section={story.market} />
      <figure className="space-y-5 rounded-2xl border border-border bg-background p-3 sm:p-6">
        <figcaption className="text-sm font-semibold">검정 메가레쿠쟈 231/XY-P · PSA 10 판매 완료 사례 (원화)</figcaption>
        <PriceColumns limit={32_000_000} points={story.sales.map((sale) => ({
          ...sale,
          label: sale.date.slice(2).replaceAll("-", "."),
        }))} />
        <ul className="divide-y divide-border border-t border-border text-xs text-muted-foreground">
          {story.sales.map((sale) => (
            <li key={sale.date} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
              <a href={sale.source.href} className="font-semibold text-foreground underline underline-offset-4">
                {sale.date} · {sale.venue} · {sale.type}
              </a>
              <span className="tabular-nums">{sale.won}</span>
            </li>
          ))}
        </ul>
      </figure>
      <section className="space-y-3" aria-labelledby="poncho-pop">
        <h2 id="poncho-pop" className="font-display text-xl font-bold">박스 판초 네 장의 PSA 10 등록 수</h2>
        <p className="text-sm text-muted-foreground">11월 21일 확인 · 208번은 Fanatics Collect 낙찰 페이지에 표시된 PSA POP</p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {story.population.map(({ image, count, source }) => (
            <div key={image.label} className="rounded-xl border border-border p-3 text-center">
              <dt className="text-sm">
                <Image src={image.src} width={image.width} height={image.height} alt={image.alt} unoptimized
                  className="mx-auto mb-3 block h-auto w-24 max-w-full rounded-md" />
                <a href={source.href} className="font-semibold underline underline-offset-4">{image.label}</a>
                <span className="mt-1 block break-keep text-xs text-muted-foreground">{image.name}</span>
              </dt>
              <dd className="mt-2 text-xl font-bold tabular-nums">{count.toLocaleString("ko-KR")}장</dd>
            </div>
          ))}
        </dl>
      </section>
      {story.closing.map((section) => <StorySection key={section.title} section={section} />)}
    </>
  );
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = stories.find((item) => item.slug === slug);
  if (!story) notFound();
  const attribution = "introImage" in story ? story.introImage.attribution : undefined;
  const sectionSources = "blackLabel" in story
    ? [...story.sections, ...story.closingSections, story.blackLabel.story].flatMap((section) => section.sources)
    : story.slug === meleeStory.slug
      ? story.sections.flatMap((section) => section.sources)
      : [];
  const references = [...new Map([...sectionSources, ...story.links].map((source) => [source.href, source])).values()];

  return (
    <article className="mx-auto max-w-3xl space-y-9">
      <Link href="/stories" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" aria-hidden /> 카드 이야기
      </Link>
      <header className="space-y-3">
        <p className="text-sm font-bold text-primary">{storyCategoryLabels[story.category]}</p>
        <h1 className="font-display text-3xl leading-tight font-bold md:text-5xl">{story.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{story.author} · <time dateTime={story.researchedOn}>{story.researchedOn}</time></span>
          <StoryViewCount slug={story.slug} />
        </div>
        <p className="text-sm text-muted-foreground">{story.card}</p>
      </header>
      <div className="space-y-4">
        {story.intro.map((paragraph) => <p key={paragraph} className="text-base leading-[1.85]">{paragraph}</p>)}
      </div>
      {story.slug === meleeStory.slug && <MeleeStoryBody story={story} />}
      {story.slug === ponchoStory.slug && <PonchoStoryBody story={story} />}
      {"blackLabel" in story && <VanGoghStoryBody story={story} />}
      <details className="border-t border-border pt-4 text-sm text-muted-foreground">
        <summary className="w-fit cursor-pointer">자료 및 사진 출처</summary>
        <ul className="mt-3 space-y-2">
          {references.map((source) => (
            <li key={source.href}>
              <a href={source.href} className="underline underline-offset-4">{source.label}</a>
            </li>
          ))}
          {attribution && <li>
            <a href={attribution.source} className="underline underline-offset-4">암스테르담 사진 원본</a>
            {" · "}
            <a href={attribution.license} className="underline underline-offset-4">{attribution.label}</a>
          </li>}
        </ul>
      </details>
      <div className="flex flex-wrap items-center gap-3">
        <StoryShareButton title={story.title} path={`/stories/${story.slug}`} />
        <Suspense fallback={<div className="w-full"><RowsSkeleton count={2} /></div>}>
          <StoryEngagement story={story} />
        </Suspense>
      </div>
    </article>
  );
}
