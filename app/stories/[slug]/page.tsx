import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment, Suspense, type ReactNode } from "react";
import { Comments } from "@/components/comments";
import { EReaderDemo } from "@/components/e-reader-demo";
import { RowsSkeleton } from "@/components/skeletons";
import { StoryLikeButton, StoryShareButton } from "@/components/story-actions";
import { StoryImageZoom } from "@/components/story-image-zoom";
import { StoryViewCount } from "@/components/story-view-count";
import { storyCategoryLabels } from "@/domains/story/types";
import { currentMember } from "@/lib/artists";
import { listComments } from "@/lib/comments";
import { getStoryLikes } from "@/lib/story-likes";
import { firstJumboStory } from "../first-pokemon-jumbo-card";
import { firstPromoStory } from "../first-pokemon-promo-card";
import { meleeKrw, meleePrice, meleeStory } from "../melee-pokemon-scramble";
import { eReaderStory } from "../pokemon-e-reader";
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
  gallery?: readonly StoryImage[];
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
  compactWon?: string;
  venue?: string;
};

function PriceColumns({ points, limit = chartLimit }: { points: readonly PricePoint[]; limit?: number }) {
  const ticks = Array.from({ length: 5 }, (_, index) => {
    const value = (4 - index) * limit / 4 / 10000;
    if (value >= 10_000) return `${(value / 10_000).toLocaleString("ko-KR")}억`;
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
                  <p className="font-bold sm:hidden">{point.compactWon ?? `${Math.round(point.krw / 10_000).toLocaleString("ko-KR")}만`}</p>
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
        <div className="invisible grid whitespace-nowrap">
          {ticks.map((tick) => <span key={tick} className="col-start-1 row-start-1">{tick}</span>)}
        </div>
        {ticks.map((tick, index) => (
          <span key={tick} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${index * 25}%` }}>
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
      <StoryImageZoom photo={image}>
        <Image
          src={image.src}
          width={image.width}
          height={image.height}
          alt={image.alt}
          unoptimized
          className="mx-auto block h-auto max-h-80 w-auto max-w-full rounded-xl border border-border object-contain"
        />
      </StoryImageZoom>
      {image.credit && (
        <figcaption className="text-xs leading-relaxed text-muted-foreground">{image.credit}</figcaption>
      )}
    </figure>
  );
}

function StorySection({ section, afterFirstImageParagraph }: { section: StorySectionData; afterFirstImageParagraph?: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold md:text-2xl">{section.title}</h2>
      {section.body.map((paragraph) => <p key={paragraph} className="text-base leading-[1.85]">{paragraph}</p>)}
      {section.image && <StoryFigure image={section.image} />}
      {section.additionalImage && <StoryFigure image={section.additionalImage} />}
      {section.gallery && (
        <div className="grid grid-cols-2 gap-4">
          {section.gallery.map((image) => <StoryFigure key={image.src} image={image} />)}
        </div>
      )}
      {section.afterImage?.map((paragraph, index) => (
        <Fragment key={paragraph}>
          <p className="text-base leading-[1.85]">{paragraph}</p>
          {index === 0 && afterFirstImageParagraph}
        </Fragment>
      ))}
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

function EReaderGallery({ title, images }: { title: string; images: readonly StoryImage[] }) {
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">{title}</h3>
      <ul className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-5 sm:gap-x-4">
        {images.map((image) => (
          <li key={image.src} className="min-w-0">
            <StoryFigure image={image} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function EReaderPackThumbnail({ pack }: { pack: StoryImage }) {
  return (
    <div className="shrink-0">
      <StoryImageZoom photo={pack}>
        <Image src={pack.src} width={pack.width} height={pack.height} alt={pack.alt} unoptimized className="h-12 w-auto rounded-sm object-contain sm:h-16" />
      </StoryImageZoom>
    </div>
  );
}

function EReaderMarkets({ market, koreanReprint }: {
  market: typeof eReaderStory.market;
  koreanReprint: StoryImage;
}) {
  return (
    <section className="space-y-6">
      <h2 className="font-display text-xl font-bold md:text-2xl">같은 그림인데, 지금 얼마에 거래될까요?</h2>
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-4 rounded-xl border border-border bg-card p-4">
        <StoryFigure image={koreanReprint} />
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">한글판 30주년 루기아 142/103 · 미감정</h3>
          <p className="text-xl font-bold tabular-nums">{market.korean.medianKrw.toLocaleString("ko-KR")}원</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {market.korean.asOf} 기준 최근 {market.korean.windowDays}일 번개장터 판매완료 표시가 {market.korean.count}건의 중앙값입니다.
            개별 구매자의 결제 금액은 공개 자료에서 확인하기 어려웠어요.
          </p>
          <a href={market.koreanSource.href} className="text-xs underline underline-offset-4">집계 페이지 보기</a>
        </div>
      </div>
      <p className="text-base leading-[1.85]">
        제가 먼저 본 건 같은 그림의 북미 원본 149/147이었어요. 같은 홀로 카드, 같은 PSA 10인데도
        아래처럼 거래 금액이 크게 달랐습니다. 10월의 두 건은 낙찰 뒤 <a href={market.paymentSource.href}
          className="underline underline-offset-4">결제 확인 기록</a>까지 대조했어요.
      </p>
      <div className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h3 className="font-semibold">북미 Aquapolis 루기아 149/147 홀로 · PSA 10</h3>
        <PriceColumns limit={500_000_000} points={market.lugiaTrend.map((sale) => ({
          amount: sale.usd, krw: sale.krw, won: sale.won, label: sale.date.slice(5), compactWon: sale.won,
        }))} />
        <ul className="space-y-1 text-xs text-muted-foreground">
          {market.lugiaTrend.map((sale) => (
            <li key={sale.date}>
              <a className="underline underline-offset-4" href={sale.href}>{sale.date} 낙찰 원문</a>
              {" · "}{sale.buyerPremium ? "구매자 수수료 포함" : "경매사 표시 금액"}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-base leading-[1.85]">
        일본 e3 초판과 북미 리자몽·뮤츠도 번호와 홀로 판본을 맞춰 찾아봤어요. 한 등급 안에서도 거래 시점에 따라 금액이 달라집니다.
        리자몽 PSA 10은 9월보다 11월의 확인 건이 낮았고, 뮤츠는 PSA 9와 10의 표본 차가 컸어요.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {market.groups.map((group) => (
          <section key={group.name} className="grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-3 rounded-xl border border-border bg-card p-4">
            <StoryImageZoom photo={group.image}>
              <Image src={group.image.src} width={group.image.width} height={group.image.height}
                alt={group.image.alt} unoptimized className="h-auto w-full rounded-md" />
            </StoryImageZoom>
            <div className="space-y-2">
              <h3 className="text-sm leading-snug font-semibold">{group.name}</h3>
              <ul className="space-y-2 text-xs">
                {group.sales.map((sale) => (
                  <li key={sale.date}>
                    <span className="font-semibold">PSA {sale.grade} · {sale.won}</span>
                    <a href={sale.href} className="mt-0.5 block text-muted-foreground underline underline-offset-4">
                      {sale.date} {sale.method === "history" ? "판매 이력" : "낙찰"}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        해외 거래는 Fanatics Collect의 표시 금액을 {market.fx.asOf} 비교 환율(1달러당 {market.fx.usdToKrw.toLocaleString("ko-KR", { maximumFractionDigits: 3 })}원)로
        환산해 만 원 단위로 반올림했습니다. 개별 낙찰과 판매 이력의 표본이며 배송비와 세금은 포함하지 않았어요.
      </p>
    </section>
  );
}

function EReaderStoryBody({ story }: { story: typeof eReaderStory }) {
  return (
    <>
      <StoryFigure image={story.image} />
      <StorySection section={story.reader} afterFirstImageParagraph={
        <EReaderDemo machop={story.machopCards[0]} />
      } />
      <EReaderGallery title="돌 깨는 게임을 여는 세 장" images={story.machopCards} />
      <section className="space-y-5">
        <StorySection section={story.japanLaunch} />
        <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-4">
          {story.japanPackage.map((image) => <StoryFigure key={image.src} image={image} />)}
        </div>
        <StoryFigure image={story.japaneseBundlePhoto} />
        <p className="text-sm text-muted-foreground">아래 전체 앞면은 동봉 카드와 같은 번호의 일본판 e1 초판입니다. SNKRDUNK에서 확인했어요.</p>
        <EReaderGallery title="일본 동봉 카드 10종" images={story.japaneseBundleCards} />
      </section>
      <section className="space-y-5">
        <StorySection section={story.usLaunch} />
        <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3">
          {story.usPackage.map((image) => <StoryFigure key={image.src} image={image} />)}
        </div>
        <EReaderGallery title="북미 샘플 팩 5종" images={story.usSampleCards} />
        {story.nesBundles.map((bundle) => (
          <div key={bundle.title} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
            <StoryFigure image={bundle.pack} />
            <EReaderGallery title={bundle.title} images={bundle.cards} />
          </div>
        ))}
      </section>
      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold md:text-2xl">햄타로도 같은 홈을 지나갔어요</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {story.otherProducts.map((product) => (
            <section key={product.title} className="space-y-2 rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold">{product.title}</h3>
              <p className="text-sm leading-relaxed">{product.description}</p>
              <div className="grid grid-cols-2 gap-3">
                <StoryFigure image={product.pack} />
                <StoryFigure image={product.card} />
              </div>
              <a href={product.catalog.href} className="inline-block text-xs underline underline-offset-4">공식 카드 목록 보기</a>
            </section>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold md:text-2xl">일본 다섯 탄과 북미 세 세트</h2>
        <p className="text-base leading-[1.85]">{story.setIntro}</p>
        <table className="w-full table-fixed border-collapse text-left text-xs leading-relaxed sm:text-sm">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="w-[43%] p-2">일본 확장팩</th>
              <th scope="col" className="w-[24%] p-2">일본 발매일</th>
              <th scope="col" className="p-2">북미 대응</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(story.sets).map((set) => {
              const english = story.englishSets[set.english];
              return (
                <tr key={set.code} className="border-b border-border">
                  <th scope="row" className="p-2 font-medium">
                    <div className="flex items-center gap-2">
                      <EReaderPackThumbnail pack={set.pack} />
                      <div className="min-w-0">
                        <a href={set.catalog.href} className="underline underline-offset-2">{set.code} · {set.name}</a>
                        <span lang="ja" className="block break-words font-normal text-muted-foreground">{set.japanese}</span>
                      </div>
                    </div>
                  </th>
                  <td className="p-2 tabular-nums">{set.date}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <EReaderPackThumbnail pack={english.pack} />
                      <div className="min-w-0">
                        <a href={english.catalog.href} className="break-words underline underline-offset-2">{english.name}</a>
                        <span className="block text-muted-foreground">{english.year}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <details className="rounded-lg border border-border px-3 py-2 text-sm">
          <summary className="cursor-pointer">전체 스캔 카드 도감</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {story.catalogs.map((catalog) => (
              <li key={catalog.href}><a href={catalog.href} className="underline underline-offset-4">{catalog.label}</a></li>
            ))}
          </ul>
        </details>
      </section>
      <StorySection section={story.crystals} />
      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold md:text-2xl">이 세 장은 어느 팩에서 나왔을까?</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {story.examples.map((card) => {
            const japanese = story.sets[card.japaneseSet];
            const english = story.englishSets[japanese.english];
            const packs = [
              { region: "일본", name: `${japanese.code} · ${japanese.name}`, year: japanese.date.slice(0, 4), number: card.japaneseNumber, image: japanese.pack },
              { region: "북미", name: english.name, year: english.year, number: card.englishNumber, image: english.pack },
            ];
            return (
              <li key={card.name} className="space-y-3 rounded-xl border border-border bg-card p-3">
                <h3 className="text-center font-semibold">{card.name}</h3>
                <StoryFigure image={{ ...card.image, credit: "북미판 카드 앞면" }} />
                <ul className="space-y-2 border-t border-border pt-3">
                  {packs.map((pack) => (
                    <li key={pack.region} className="flex items-center gap-2 text-xs leading-relaxed">
                      <EReaderPackThumbnail pack={pack.image} />
                      <div>
                        <p className="font-semibold">{pack.name}</p>
                        <p className="text-muted-foreground">{pack.region} · {pack.year}년 · {pack.number}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>
      <StorySection section={story.anniversary} />
      <StoryFigure image={story.koreanPack} />
      <div className="grid grid-cols-2 items-start gap-3 sm:gap-5">
        {story.comparison.map((image) => <StoryFigure key={image.src} image={image} />)}
      </div>
      <EReaderMarkets market={story.market} koreanReprint={story.comparison[1]} />
      <div className="space-y-4">
        {story.closing.map((paragraph) => <p key={paragraph} className="text-base leading-[1.85]">{paragraph}</p>)}
      </div>
    </>
  );
}

function FirstJumboStoryBody({ story }: { story: typeof firstJumboStory }) {
  const { size, market } = story;
  const [firstPsa7, lastPsa7] = market.psa7Trend;

  return (
    <>
      <section aria-labelledby="jumbo-size" className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
        <h2 id="jumbo-size" className="font-display text-xl font-bold">일반 카드 다섯 장보다 넓어요</h2>
        <div className="mx-auto grid max-w-md grid-cols-[145fr_63fr] items-end gap-x-4 gap-y-2 text-center sm:gap-x-8">
          <StoryImageZoom photo={story.image}>
            <Image src={story.image.src} width={story.image.width} height={story.image.height}
              alt={story.image.alt} unoptimized className="h-auto w-full rounded-md" />
          </StoryImageZoom>
          <div className="aspect-[63/88] rounded-md border-2 border-dashed border-muted-foreground/50 bg-muted" aria-hidden="true" />
          <p className="self-start text-xs font-semibold">1997년 점보 · {size.widthMm} × {size.heightMm}mm</p>
          <p className="self-start text-xs font-semibold">일반 카드 · {size.standardWidthMm} × {size.standardHeightMm}mm</p>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">두 카드를 같은 축척으로 비교했습니다. 점보 실물은 A5(148 × 210mm)와 세로가 같고, 폭이 약 3mm 좁아요.</p>
      </section>
      <StorySection section={story.magazine} />
      <StorySection section={story.joke} />
      <StoryFigure image={size.hero} />
      <StorySection section={story.grading} />
      <section className="space-y-5">
        <h2 className="font-display text-xl font-bold md:text-2xl">요즘 이 책받침은 얼마에 거래돼요?</h2>
        <p className="text-base leading-[1.85]">
          2026년 10월 17~23일 eBay에서 팔린 미감정 단품 {market.rawCount}건을 모아보니
          {" "}{market.rawRange[0]}부터 {market.rawRange[1]}까지였어요. 가운데 값은 <strong>{market.rawMedian}</strong>입니다.
          표본에는 판매자가 MP(사용감 있음)와 LP(가벼운 사용감)로 기재한 카드가 함께 들어 있어요.
        </p>
        <div className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="font-semibold">eBay 미감정 MP 단품 · 2026년 10월</h3>
          <PriceColumns limit={200_000} points={market.rawTrend.map((sale, index) => ({
            ...sale, label: index === 0 ? sale.label : `${sale.label} · ${index === 1 ? "A" : "B"}`,
          }))} />
          <p className="text-xs text-muted-foreground">같은 날의 두 막대는 별개 거래입니다. 완료일과 금액은 Misprint의 eBay 거래 집계에서 확인했습니다.</p>
          <ul className="space-y-1 text-xs">
            {market.rawTrend.map((sale) => (
              <li key={sale.usd}>
                {sale.date} · {sale.won}
                {sale.listing && <a href={sale.listing} className="ml-2 underline underline-offset-4">eBay 상품 사진</a>}
              </li>
            ))}
            <li><a href={market.rawTrend[0].sourceLink.href} className="underline underline-offset-4">Misprint 완료 거래 집계</a></li>
          </ul>
        </div>
        <p className="text-base leading-[1.85]">
          일본에서는 메루카리 판매완료품 중 접힘·눌림이 있는 것이 {market.mercariLowSold}, 사진처럼 위쪽에 주름이 있는 것이 {market.mercariSold}였어요.
          두 글은 일본 내 배송비가 포함된 표시 가격이고 정확한 거래 날짜는 공개되지 않았습니다. 11월 21일에 스루가야가 올려둔 중고 판매가는
          {" "}{market.surugayaAsk}이었어요. 이쪽은 상점 호가입니다.
        </p>
        <div className="grid grid-cols-2 items-start gap-3">
          <StoryFigure image={market.sold} />
          <StoryFigure image={market.wear} />
        </div>
        <div className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="font-semibold">PSA 7 단품의 eBay 완료 거래 · 2026년</h3>
          <PriceColumns limit={600_000} points={market.psa7Trend} />
          <ul className="space-y-1 text-xs text-muted-foreground">
            {[firstPsa7, lastPsa7].map((sale) => (
              <li key={sale.date}><a href={sale.sourceLink.href} className="underline underline-offset-4">{sale.date} · {sale.won} · eBay 거래 집계</a></li>
            ))}
          </ul>
        </div>
        <p className="text-base leading-[1.85]">
          같은 판본 PSA 6은 5월 8일 <a href={market.psa6.sourceLink.href} className="underline underline-offset-4">{market.psa6.won} 거래 기록</a>이 있어요. 이 한 건은 위 PSA 7의 10월 표본보다 비쌌습니다.
          거래가 뜸하니 등급이 한 칸 오를 때마다 일정하게 비싸지는 식으로 읽기 어려워요.
          헤리티지의 2025년 6월 18일 {market.heritage}은 여기에 〈피카츄의 여름방학〉 PSA 7까지 함께 들어간 두 장 묶음이었습니다.
          PSA 8 이상은 공개 원거래를 대조할 수 있는 표본이 부족해 시세를 잡기 어려웠어요.
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          해외 금액은 {market.fx.date} 비교 환율(1달러 1,345.855원, 1엔 약 8.443원)을 적용해 천 원 단위로 반올림했습니다.
          개별 거래의 한국 결제 금액, 해외 배송비나 세금은 확인 범위에 포함되지 않습니다.
        </p>
      </section>
      <div className="space-y-4">
        {story.closing.map((paragraph) => <p key={paragraph} className="text-base leading-[1.85]">{paragraph}</p>)}
      </div>
    </>
  );
}

function FirstPromoMarket({ market }: { market: typeof firstPromoStory.market }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {market.photos.map((image) => <StoryFigure key={image.src} image={image} />)}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {market.checkedOn} 확인. Fanatics Collect의 구매자 수수료는 포함했습니다. eBay는 판매 완료 표시에 나온 금액이며 배송비는 별도예요.
        비교용으로 11월 24일 환율(1달러 {market.usdToKrw.toLocaleString("ko-KR")}원)을 적용해 만 원 단위로 반올림했습니다.
      </p>
      {[
        { grade: "PSA 7", limit: 28_000_000 },
        { grade: "PSA 8", limit: 80_000_000 },
      ].map(({ grade, limit }) => {
        const sales = market.sales.filter((sale) => sale.grade === grade);
        return (
          <figure key={grade} className="space-y-4 rounded-2xl border border-border p-3 sm:p-6">
            <figcaption className="text-sm font-semibold">223호 광택 피카츄 · {grade} · {sales.length}건</figcaption>
            <PriceColumns limit={limit} points={sales.map((sale) => ({
              amount: sale.usd,
              krw: sale.krw,
              won: sale.won,
              label: sale.date.slice(5).replace("-", "."),
              venue: sale.venue,
            }))} />
            <ul className="divide-y divide-border border-t border-border text-sm">
              {sales.map((sale) => (
                <li key={sale.href} className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-2">
                  <a href={sale.href} className="underline underline-offset-4">{sale.date} · {sale.venue}</a>
                  <span className="tabular-nums">{sale.won}</span>
                </li>
              ))}
            </ul>
          </figure>
        );
      })}
      <ul className="divide-y divide-border border-y border-border text-sm">
        {market.sales.filter((sale) => sale.grade === "PSA 4" || sale.grade === "PSA 9 (OC)").map((sale) => (
          <li key={sale.href} className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-2">
            <a href={sale.href} className="underline underline-offset-4">{sale.grade} · {sale.date} · {sale.venue}</a>
            <span className="tabular-nums">{sale.won}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FirstPromoStoryBody({ story }: { story: typeof firstPromoStory }) {
  return (
    <>
      <StorySection section={story.magazine} afterFirstImageParagraph={<StoryFigure image={story.insert} />} />
      <StorySection section={story.dates} />
      <StorySection section={story.faces} />
      <StorySection section={story.logan} />
      <ul className="space-y-2 text-sm">
        {story.videos.map((video) => (
          <li key={video.href}><a href={video.href} className="underline underline-offset-4">{video.label}</a></li>
        ))}
      </ul>
      <StorySection section={story.marketIntro} />
      <FirstPromoMarket market={story.market} />
      <StorySection section={story.expensive} />
      <StorySection section={story.closing} />
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
      {story.slug === eReaderStory.slug && <EReaderStoryBody story={story} />}
      {story.slug === firstJumboStory.slug && <FirstJumboStoryBody story={story} />}
      {story.slug === firstPromoStory.slug && <FirstPromoStoryBody story={story} />}
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
