"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PokeballMark } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

type Slide = {
  tag: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  gradient: string;
};

const SLIDES: Slide[] = [
  {
    tag: "이달의 특집",
    title: "9포켓 바인더를 채우는\n베스트 확장 아트",
    subtitle: "카드 번호만 입력하면 딱 맞는 도안이 나와요.",
    cta: "카드 검색하기",
    href: "/search",
    gradient: "from-red-500 via-red-600 to-ink-900",
  },
  {
    tag: "작가 모집",
    title: "내 확장 아트를\n카드 번호로 공유하세요",
    subtitle: "승인된 작가는 도안을 올리고 작가 페이지를 가져요.",
    cta: "작가 신청하기",
    href: "/artist/new",
    gradient: "from-ink-900 via-ink-800 to-red-700",
  },
  {
    tag: "PSA · BRG",
    title: "슬랩 위에 덧씌우는\n확장 아트 스킨",
    subtitle: "규격별로 인쇄 치수까지 안내해드려요.",
    cta: "둘러보기",
    href: "/search",
    gradient: "from-red-600 via-ink-800 to-ink-900",
  },
];

export const HomeBanner = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <section
      className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl sm:aspect-[16/7] md:aspect-[21/7]"
      aria-roledescription="carousel"
      aria-label="주요 소식"
    >
      {SLIDES.map((slide, i) => (
        <div
          key={slide.title}
          aria-hidden={i !== index}
          className={cn(
            "absolute inset-0 bg-gradient-to-br transition-opacity duration-700",
            slide.gradient,
            i === index ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <PokeballMark className="pointer-events-none absolute -right-10 -top-10 size-64 opacity-10 md:size-80" />
          <div className="relative flex h-full flex-col justify-center gap-3 p-6 md:p-12">
            <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {slide.tag}
            </span>
            <h2 className="whitespace-pre-line font-display text-2xl font-bold leading-tight text-white md:text-4xl">
              {slide.title}
            </h2>
            <p className="max-w-md text-sm text-white/85 md:text-base">{slide.subtitle}</p>
            <Link
              href={slide.href}
              className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink-900 transition-transform hover:scale-[1.03]"
            >
              {slide.cta}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      ))}

      <div className="absolute bottom-4 left-6 flex gap-1.5 md:left-12">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.title}
            type="button"
            aria-label={`${i + 1}번 배너로`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className={cn(
              "h-2 rounded-full transition-all",
              i === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80",
            )}
          />
        ))}
      </div>
    </section>
  );
};
