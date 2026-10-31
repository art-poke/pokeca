"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Ruler, X, ZoomIn } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// 도안 규격 및 정보: 9포켓·PSA·BRG별 실측 치수와 참고 사진을 보여 주는 안내 모달.
// 사진은 public/specs/ (실제 제품·슬랩 치수 도식). 사진 클릭 시 전체화면으로 크게 본다.

type Spec = {
  key: string;
  label: string;
  images: { src: string; alt: string }[];
  size: string; // 도안(인쇄) 크기
  points: string[];
};

const SPECS: Spec[] = [
  {
    key: "9pocket",
    label: "9포켓",
    images: [{ src: "/specs/9pocket.png", alt: "9포켓 바인더 3×3 조립 예시" }],
    size: "조각 8장 · 각 63 × 88 mm (표준 카드 크기)",
    points: [
      "3×3 바인더 속지에 들어가요. 가운데 칸엔 실제 카드, 둘레 8칸에 도안 조각을 끼워요.",
      "조각 하나하나가 카드와 같은 63×88 mm라, 모으면 가운데 카드를 감싸는 한 장의 그림이 돼요.",
      "업로드는 ‘낱개 8칸’(원하는 자리에 배치) 또는 ‘조립본 한 장’(8칸 모인 파일) 중 선택.",
    ],
  },
  {
    key: "psa",
    label: "PSA",
    images: [
      { src: "/specs/psa-slab.png", alt: "PSA 슬랩 치수" },
      { src: "/specs/case-diagram.png", alt: "알루미늄 보관 케이스 치수" },
    ],
    size: "1장 · 80 × 135 mm (케이스 내경)",
    points: [
      "PSA 슬랩(외곽 약 80 × 135.75 mm) 위에 알루미늄 보관 케이스를 덧씌워요.",
      "케이스: 제품 86 × 142 mm, 내경 80 × 135 mm, 두께 1.1 cm (알루미늄 합금).",
      "도안은 슬랩 앞쪽, 케이스 안쪽(80 × 135 mm)에 맞춰 1장 넣어요.",
    ],
  },
  {
    key: "brg",
    label: "BRG",
    images: [
      { src: "/specs/brg-slab.png", alt: "BRG 슬랩 치수" },
      { src: "/specs/case-diagram.png", alt: "알루미늄 보관 케이스 치수" },
    ],
    size: "1장 · 80 × 135 mm (케이스 내경)",
    points: [
      "BRG 슬랩(외곽 약 80 × 130 mm) 위에 알루미늄 보관 케이스를 덧씌워요.",
      "케이스: 제품 86 × 142 mm, 내경 80 × 135 mm, 두께 1.1 cm (알루미늄 합금).",
      "도안은 슬랩 앞쪽, 케이스 안쪽(80 × 135 mm)에 맞춰 1장 넣어요.",
    ],
  },
];

export function SpecInfoButton({ className }: { className?: string }) {
  const [tab, setTab] = useState(SPECS[0].key);
  const [zoom, setZoom] = useState<string | null>(null);
  const active = SPECS.find((s) => s.key === tab) ?? SPECS[0];
  const single = active.images.length === 1;

  return (
    <Dialog.Root onOpenChange={(o) => !o && setZoom(null)}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-semibold text-ink-700 transition-colors hover:border-primary hover:text-primary",
            className,
          )}
        >
          <Ruler className="size-4" aria-hidden />
          규격 및 정보
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[min(72rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <Dialog.Title className="flex items-center gap-2 font-display text-xl font-bold text-foreground">
              <Ruler className="size-5 text-primary" aria-hidden />
              도안 규격 및 정보
            </Dialog.Title>
            <Dialog.Close className="inline-flex size-9 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-gray-100">
              <X className="size-5" />
              <span className="visually-hidden">닫기</span>
            </Dialog.Close>
          </div>

          <Dialog.Description className="px-6 pt-4 text-sm text-muted-foreground">
            규격별 실제 치수예요. 이 크기에 맞춰 도안을 만들면 바로 끼워 쓸 수 있어요. 사진을 누르면 크게 볼 수 있어요.
          </Dialog.Description>

          <div className="px-6 pt-4">
            <div className="inline-flex rounded-xl bg-muted p-1">
              {SPECS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={tab === s.key}
                  onClick={() => setTab(s.key)}
                  className={cn(
                    "rounded-lg px-5 py-2 text-sm font-semibold transition-colors",
                    tab === s.key
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <p className="mb-4 inline-flex rounded-lg bg-accent px-3.5 py-2 text-base font-semibold text-accent-foreground">
              도안 크기 · {active.size}
            </p>
            <div className={cn("grid gap-4", single ? "grid-cols-1" : "sm:grid-cols-2")}>
              {active.images.map((img) => (
                <button
                  key={img.src}
                  type="button"
                  onClick={() => setZoom(img.src)}
                  className="group relative flex cursor-zoom-in items-center justify-center overflow-hidden rounded-xl border border-border bg-gray-50 p-3 transition-colors hover:border-primary"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.src}
                    alt={img.alt}
                    className={cn(
                      "w-auto object-contain",
                      single ? "max-h-[62vh]" : "max-h-[46vh]",
                    )}
                  />
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink-900/70 px-2 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <ZoomIn className="size-3.5" aria-hidden />
                    크게 보기
                  </span>
                </button>
              ))}
            </div>
            <ul className="mt-5 space-y-2.5">
              {active.points.map((p) => (
                <li key={p} className="flex gap-2 text-sm text-ink-700">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </Dialog.Content>

        {/* 사진 확대(라이트박스): 아무 데나 누르면 닫힘 */}
        {zoom && (
          <button
            type="button"
            onClick={() => setZoom(null)}
            className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-ink-900/85 p-4 data-[state=open]:animate-in"
            aria-label="사진 닫기"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom} alt="규격 사진 크게 보기" className="max-h-[94vh] max-w-[94vw] object-contain" />
            <span className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full bg-white/15 text-white">
              <X className="size-5" />
            </span>
          </button>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}
