"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./home-banner.module.css";

type BannerExample = {
  id: string;
  cardName: string;
  cardImage: string;
  artistName: string;
  positions: number[];
};

type BannerStory = { slug: string; title: string; image: string };

export function HomeBanner({ example, story }: { example?: BannerExample; story: BannerStory }) {
  const [index, setIndex] = useState(0);
  const slides = [
    { label: "확장 도안", color: "bg-[#10192c]" },
    { label: "카드 이야기", color: "bg-[#163631]" },
    ...(example ? [{ label: "최근 도안", color: "bg-[#302348]" }] : []),
  ];
  const banner = useRef<HTMLElement>(null);
  const slideCount = slides.length;

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setInterval(() => {
      if (!reducedMotion.matches && !banner.current?.matches(":hover, :focus-within")) {
        setIndex((current) => (current + 1) % slideCount);
      }
    }, 5500);
    return () => window.clearInterval(timer);
  }, [index, slideCount]);

  return (
    <section ref={banner} aria-roledescription="캐러셀" aria-label="홈 배너" className="relative overflow-hidden rounded-3xl text-white">
      <div className="flex motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-in-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((slide, i) => {
          const isStory = i === 1;
          const isRecent = i === 2 && !!example;
          return (
            <div key={slide.label} inert={i !== index} className={`grid w-full shrink-0 pb-6 min-[360px]:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] md:grid-cols-2 ${slide.color}`}>
              <div className="flex flex-col items-start justify-center gap-3 px-5 pt-5 min-[360px]:pb-3 sm:px-8 md:py-6">
                <h2 id={i === 0 ? "home-banner-title" : undefined} className="font-display text-2xl leading-tight font-bold break-keep sm:text-3xl lg:text-4xl">
                  {isStory ? "카드 한 장에 무슨 일이 있었길래?" : isRecent ? "요즘 올라온 확장 도안" : <>카드 한 장에서<br />이어지는 그림</>}
                </h2>
                <p className="max-w-sm text-sm leading-relaxed break-keep text-white/80 md:text-base">
                  {isStory ? story.title : isRecent ? `${example.cardName} 카드에서 이어지는 @${example.artistName}의 그림을 만나보세요.` : "카드 속 풍경을 바인더 밖까지. 카드 이름이나 번호로 어울리는 확장 도안을 찾아보세요."}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <Link href={isStory ? `/stories/${story.slug}` : isRecent ? `/artworks/${example.id}` : "/search"} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-blue-100">
                    {isStory ? "최신 이야기 읽기" : isRecent ? "도안 자세히 보기" : "카드 검색하기"} <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <Link href={isStory ? "/stories" : isRecent ? "/artworks" : "/artist/new"} className="text-sm font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline">
                    {isStory ? "전체 이야기" : isRecent ? "전체 도안" : "도안 올리기"}
                  </Link>
                </div>
              </div>
              <div className="relative grid min-w-0 content-center">
                {isStory ? (
                  <div className="relative grid min-h-36 place-items-center px-3 py-3 md:px-5 md:min-h-64">
                    <Link href={`/stories/${story.slug}`} aria-label={story.title} className={`relative block w-full max-w-60 overflow-hidden md:max-w-xs rounded-2xl shadow-2xl ring-1 ring-white/20 ${styles.original}`}>
                      <Image src={story.image} alt="" width={1200} height={630} unoptimized className="h-auto w-full" />
                    </Link>
                  </div>
                ) : isRecent ? (
                  <Link
                    href={`/artworks/${example.id}`}
                    className="group relative grid min-h-36 content-center justify-items-center gap-2 overflow-hidden px-3 py-3 md:px-5 md:min-h-64"
                  >
                    <div className={styles.stage} aria-hidden="true" />
                    {example.positions.length > 1 ? (
                      <div className="relative grid w-32 max-w-full grid-cols-3 gap-1 rounded-xl bg-slate-950/60 p-1 md:w-40">
                        {Array.from({ length: 9 }, (_, cell) => {
                          const piece = cell < 4 ? cell : cell - 1;
                          const src = cell === 4 ? example.cardImage : example.positions.includes(piece) ? `/api/thumbnails/${example.id}?i=${piece}` : null;
                          return (
                            <div key={cell} className={`relative aspect-[63/88] rounded-sm bg-slate-700/45 ${cell === 4 ? styles.original : styles.piece}`}>
                              {src && <Image src={src} alt={cell === 4 ? "가운데에 놓인 원본 카드" : ""} fill unoptimized loading="eager" className="rounded-sm object-cover" />}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="relative flex w-full max-w-56 items-center justify-center gap-3 lg:gap-5">
                        <div className={`relative aspect-[63/88] w-[35%] rotate-[-8deg] ${styles.original}`}>
                          <Image src={example.cardImage} alt="원본 카드" fill unoptimized loading="eager" className="rounded-lg object-contain drop-shadow-xl" />
                        </div>
                        <ArrowRight className="size-5 shrink-0 text-blue-200/80" aria-hidden />
                        <div className={`relative aspect-[63/88] w-[42%] rotate-[8deg] rounded-lg bg-slate-800 ring-1 ring-white/20 ${styles.piece}`}>
                          <Image src={`/api/thumbnails/${example.id}?i=${example.positions[0] ?? 0}`} alt="확장 도안" fill unoptimized loading="eager" className="rounded-lg object-contain drop-shadow-xl" />
                        </div>
                      </div>
                    )}
                    <p className="relative text-center text-xs leading-relaxed font-medium text-slate-300 group-hover:text-white">
                      {example.cardName} <span aria-hidden="true">·</span> @{example.artistName}의 도안 <span aria-hidden="true">↗</span>
                    </p>
                  </Link>
                ) : (
                  <figure className="relative grid min-h-36 content-center justify-items-center overflow-hidden px-3 py-3 md:px-5 md:min-h-64">
                    <div className={styles.stage} aria-hidden />
                    <Image
                      src="/specs/home/lugia-v-binder.webp"
                      alt="폭풍과 파도가 이어지는 9포켓 도안 한가운데 놓인 루기아 V 카드"
                      width={714}
                      height={982}
                      unoptimized
                      loading="eager"
                      className={`relative w-32 max-w-full rounded-lg shadow-[0_18px_40px_#020617aa] ring-1 ring-white/25 md:w-40 ${styles.original}`}
                    />
                  </figure>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div role="group" aria-label="배너 선택" className="absolute inset-x-0 bottom-1 flex justify-center">
        {slides.map((slide, i) => (
          <button key={slide.label} type="button" aria-label={slide.label} aria-pressed={i === index} onClick={() => setIndex(i)} className="group grid size-6 place-items-center rounded-full">
            <span aria-hidden className="size-1.5 rounded-full bg-white/50 group-hover:bg-white/80 group-aria-pressed:bg-white" />
          </button>
        ))}
      </div>
    </section>
  );
}
