"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

// 카드 상세의 공식 카드 이미지. 작게 보이던 걸 눌러 크게 본다(라이트박스).
// 오버레이는 바깥/닫기/ESC로 닫힌다. 열려 있는 동안 배경 스크롤을 잠근다.
export function CardImageZoom({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative shrink-0 cursor-zoom-in self-start rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${alt} 크게 보기`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          width={217}
          height={303}
          loading="eager"
          className="aspect-[63/88] w-20 rounded-xl border border-border object-cover transition-transform group-hover:scale-[1.02] sm:w-28 md:w-32"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="닫기"
          >
            <X className="size-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90dvh] w-auto max-w-[min(90vw,32rem)] rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
