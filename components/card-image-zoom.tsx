"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// 카드 상세의 공식 카드 이미지. 작게 보이던 걸 눌러 크게 본다(라이트박스 모달).
// 모달은 createPortal로 document.body에 렌더한다 — 상세 페이지 .enter 애니메이션이 남기는
// transform(translateY) 때문에 그냥 fixed를 쓰면 기준이 article로 바뀌어 화면 전체를 못 덮는다.
// 바깥/닫기/ESC로 닫히고, 열려 있는 동안 배경 스크롤을 잠근다.
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
          width={367}
          height={512}
          loading="eager"
          className="aspect-[63/88] w-28 rounded-xl border border-border object-cover shadow-sm transition-transform group-hover:scale-[1.02] sm:w-36 md:w-44"
        />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
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
              className="max-h-[92dvh] w-auto max-w-[min(92vw,34rem)] cursor-default rounded-2xl object-contain shadow-2xl"
            />
          </div>,
          document.body,
        )}
    </>
  );
}
