# AppImage 이미지 컴포넌트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로딩 스켈레톤·실패 폴백·레이아웃 시프트 제거를 담은 공유 `<AppImage>` 컴포넌트를 만들고, 흩어진 raw `<img>`를 교체한다.

**Architecture:** 전달·렌더·로딩 전략을 분리한다. 이 플랜은 **렌더 컴포넌트**만 다룬다. `<AppImage>`는 내부적으로 지금은 plain `<img>`로 그리되(302 프록시·서명 URL 그대로 동작), 상태 머신(loading→loaded/error)·aspect 박스(CLS=0)·variant 프리셋·폴백을 입힌다. 공개 CDN 전환 + `next/image` 옵티마이저는 **별도 인프라 선행조건**이며, 이 컴포넌트의 공개 API를 바꾸지 않고 내부 렌더러만 교체할 수 있도록 `isOptimizable` 시임을 남긴다.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Storybook 10(`@storybook/nextjs-vite`) + `@vitest/browser-playwright`(스토리=브라우저 테스트), vitest node 프로젝트(순수 로직 테스트).

**Spec:** `docs/superpowers/specs/2026-11-06-image-rendering-strategy-design.md`

**Scope note:** 공개 CDN 전달 전환, blur/LQIP, 공식 카드 이미지 404 복구는 **이 플랜 밖**(스펙의 선행조건/비목표). 여기서는 컴포넌트 + 폴백 + 프리셋 + 마이그레이션 + 스토리까지.

---

## File Structure

**Create:**
- `components/ui/app-image-presets.ts` — 순수 설정: variant→{aspectRatio, sizes, fit} 프리셋 + `isOptimizable(src)` 시임. React 의존 없음(`.ts`).
- `components/ui/app-image-presets.test.ts` — 프리셋·`isOptimizable` 노드 유닛 테스트.
- `components/ui/app-image-fallback.tsx` — variant별 폴백(깨진-아이콘 대신). 순수 표현.
- `components/ui/app-image.tsx` — `<AppImage>` 클라이언트 컴포넌트(상태 머신).
- `components/ui/app-image.stories.tsx` — loading/loaded/error/null 스토리(=브라우저 테스트).

**Modify:**
- `vitest.config.mts:25` — 노드 프로젝트 include에 `components/**/*.test.ts` 추가.
- `components/card-tile.tsx` — 첫 소비자로 `<AppImage variant="card">` 적용.
- 이후 12개 파일(Task 5 목록) 점진 교체.

---

## Task 1: 프리셋 + `isOptimizable` 시임

**Files:**
- Modify: `vitest.config.mts:25`
- Create: `components/ui/app-image-presets.ts`
- Test: `components/ui/app-image-presets.test.ts`

- [ ] **Step 1: 노드 테스트가 components/ 를 잡도록 include 확장**

`vitest.config.mts` 25번 줄의 include 배열에 `"components/**/*.test.ts"` 추가:

```ts
include: ["lib/**/*.test.ts", "tests/*.test.ts", "tests/integration/**/*.test.ts", "components/**/*.test.ts"],
```

- [ ] **Step 2: 실패하는 테스트 작성**

`components/ui/app-image-presets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { APP_IMAGE_PRESETS, isOptimizable } from "./app-image-presets";

describe("app-image presets", () => {
  it("has a preset for every variant with sizes + fit", () => {
    for (const v of ["card", "avatar", "artwork", "photo"] as const) {
      expect(APP_IMAGE_PRESETS[v].sizes).toBeTruthy();
      expect(["cover", "contain"]).toContain(APP_IMAGE_PRESETS[v].fit);
    }
  });

  it("card is a trading-card ratio, artwork has no fixed ratio", () => {
    expect(APP_IMAGE_PRESETS.card.aspectRatio).toBe("63 / 88");
    expect(APP_IMAGE_PRESETS.artwork.aspectRatio).toBeUndefined();
  });

  it("isOptimizable is false until a CDN host is configured", () => {
    expect(isOptimizable("https://example.com/a.webp")).toBe(false);
    expect(isOptimizable("/api/card-images/sv6/sv6_109.webp")).toBe(false);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run components/ui/app-image-presets.test.ts --project default`
Expected: FAIL — `Cannot find module './app-image-presets'`

- [ ] **Step 4: 최소 구현**

`components/ui/app-image-presets.ts`:

```ts
export type AppImageVariant = "card" | "avatar" | "artwork" | "photo";

type Preset = { aspectRatio?: string; sizes: string; fit: "cover" | "contain" };

// variant가 비율·반응형 크기·채움 방식의 기본값을 정한다. 호출부는 variant만 고르면 된다.
export const APP_IMAGE_PRESETS: Record<AppImageVariant, Preset> = {
  card: {
    aspectRatio: "63 / 88",
    sizes: "(max-width:640px) 45vw, (max-width:1024px) 30vw, 220px",
    fit: "cover",
  },
  avatar: { aspectRatio: "1 / 1", sizes: "48px", fit: "cover" },
  // artwork은 비율 가변 → 호출부가 aspectRatio를 반드시 넘긴다(CLS=0 보장).
  artwork: { aspectRatio: undefined, sizes: "(max-width:768px) 100vw, 720px", fit: "contain" },
  photo: { aspectRatio: "4 / 3", sizes: "(max-width:768px) 100vw, 720px", fit: "cover" },
};

// 공개 CDN 전환 후 호스트를 채우면 <AppImage>가 next/image 최적화 경로로 바뀐다(현재는 전부 비최적화).
export const OPTIMIZABLE_HOSTS: readonly string[] = [];

export const isOptimizable = (src: string): boolean => {
  try {
    return OPTIMIZABLE_HOSTS.includes(new URL(src).host);
  } catch {
    return false; // 상대경로(/api/…) 등은 최적화 대상 아님
  }
};
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run components/ui/app-image-presets.test.ts --project default`
Expected: PASS (3 tests)

- [ ] **Step 6: 커밋**

```bash
git add vitest.config.mts components/ui/app-image-presets.ts components/ui/app-image-presets.test.ts
git commit -m "feat(image): AppImage variant 프리셋 + isOptimizable 시임"
```

---

## Task 2: `AppImageFallback` (깨진-아이콘 대신)

**Files:**
- Create: `components/ui/app-image-fallback.tsx`
- Test: `components/ui/app-image.stories.tsx`(이 태스크에선 Fallback 스토리만)

- [ ] **Step 1: 실패 스토리 작성**

`components/ui/app-image.stories.tsx` (초기 — 폴백 검증만):

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor, within } from "storybook/test";
import { AppImageFallback } from "./app-image-fallback";

const meta = {
  title: "Atoms/AppImage",
  component: AppImageFallback,
} satisfies Meta<typeof AppImageFallback>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FallbackCard: Story = {
  render: () => (
    <div className="w-40" style={{ aspectRatio: "63 / 88" }}>
      <AppImageFallback variant="card" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    // 깨진 <img>가 아니라 몬스터볼 폴백이 보여야 한다.
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("img", { hidden: true })).toBeInTheDocument();
    await expect(canvasElement.querySelector("img[src]")).toBeNull();
  },
};

export const FallbackAvatar: Story = {
  render: () => (
    <div className="size-12">
      <AppImageFallback variant="avatar" label="별빛" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent).toContain("별");
  },
};
```

- [ ] **Step 2: 스토리 실패 확인**

Run: `npx vitest run --project storybook -t AppImage`
Expected: FAIL — `Cannot find module './app-image-fallback'`

> 참고: 이 레포 **최초의 `play:` 인터랙션 스토리**다. 처음 한 번은 브라우저(Playwright/chromium) 툴체인이 실제로 깔려·연결됐는지 확인하자 — 위 명령이 "모듈 없음"이 아니라 브라우저 미설치/연결 오류로 떨어지면 `npx playwright install chromium` 후 재시도.

- [ ] **Step 3: 최소 구현**

`components/ui/app-image-fallback.tsx`:

```tsx
import { PokeballMark } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import type { AppImageVariant } from "./app-image-presets";

// 이미지가 없거나 로드 실패했을 때 보여주는 중립 자리. 브라우저 깨진-아이콘/alt 노출 금지.
// 색·여백은 DESIGN 토큰만. 카드처럼 더 풍부한 폴백이 필요하면 <AppImage fallback=…>로 교체한다.
export const AppImageFallback = ({
  variant,
  label,
  className,
}: {
  variant: AppImageVariant;
  label?: string;
  className?: string;
}) => {
  if (variant === "avatar") {
    return (
      <div
        className={cn(
          "flex size-full items-center justify-center bg-gray-100 text-ink-500",
          className,
        )}
        aria-hidden
      >
        <span className="text-sm font-bold">{label?.trim()?.[0]?.toUpperCase() ?? "?"}</span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex size-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200",
        className,
      )}
      aria-hidden
    >
      <PokeballMark className="size-10 opacity-20" />
    </div>
  );
};
```

- [ ] **Step 4: 스토리 통과 확인**

Run: `npx vitest run --project storybook -t AppImage`
Expected: PASS (FallbackCard, FallbackAvatar)

- [ ] **Step 5: 커밋**

```bash
git add components/ui/app-image-fallback.tsx components/ui/app-image.stories.tsx
git commit -m "feat(image): AppImageFallback — variant별 우아한 폴백"
```

---

## Task 3: `<AppImage>` 상태 머신

**Files:**
- Create: `components/ui/app-image.tsx`
- Test: `components/ui/app-image.stories.tsx`(스토리 추가)

- [ ] **Step 1: 상태 전이 스토리 추가(실패)**

`components/ui/app-image.stories.tsx`에 추가. (1x1 투명 PNG data URI = 즉시 로드, 잘못된 경로 = onError)

```tsx
import { AppImage } from "./app-image";

const OK_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

export const Loaded: StoryObj = {
  render: () => (
    <div className="w-40">
      <AppImage variant="card" src={OK_SRC} alt="로드 성공" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const img = canvasElement.querySelector("img") as HTMLImageElement;
    await expect(img).toBeTruthy();
    await new Promise((r) => (img.complete ? r(null) : img.addEventListener("load", () => r(null))));
    await expect(img.className).toContain("opacity-100");
  },
};

export const ErrorFallsBack: StoryObj = {
  render: () => (
    <div className="w-40">
      <AppImage variant="card" src="/__nope__.png" alt="로드 실패" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    // onError 후 <img>는 사라지고 폴백(몬스터볼 svg)만 남는다.
    // 고정 setTimeout 대신 이벤트 기반 waitFor로 대기 → CI 부하에도 플레이크 없음.
    await waitFor(() => {
      expect(canvasElement.querySelector('img[src="/__nope__.png"]')).toBeNull();
      expect(canvasElement.querySelector("svg")).toBeTruthy();
    });
  },
};

export const NullSrcIsImmediatelyFallback: StoryObj = {
  render: () => (
    <div className="w-40">
      <AppImage variant="card" src={null} alt="" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("img[src]")).toBeNull();
    await expect(canvasElement.querySelector("svg")).toBeTruthy();
  },
};
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run --project storybook -t AppImage`
Expected: FAIL — `Cannot find module './app-image'`

- [ ] **Step 3: 구현**

`components/ui/app-image.tsx`:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppImageFallback } from "./app-image-fallback";
import { APP_IMAGE_PRESETS, type AppImageVariant } from "./app-image-presets";

type AppImageProps = {
  src: string | null | undefined;
  alt: string;
  variant?: AppImageVariant;
  sizes?: string; // 최적화(next/image) 전환 뒤 의미. 지금은 무해하게 무시된다.
  priority?: boolean; // 첫 화면 히어로/첫 줄만 true
  fit?: "cover" | "contain";
  aspectRatio?: string; // artwork는 필수
  fallback?: ReactNode; // 카드 set/number 같은 풍부한 폴백 override
  className?: string; // 바깥 박스
};

// 로딩=스켈레톤, 로드=페이드인, 실패/빈값=폴백. 바깥 aspect 박스로 자리를 선확보해 CLS=0.
// 지금은 plain <img>로 그린다(302 프록시·서명 URL 동작). CDN+next/image 전환 시 이 내부만 교체.
export const AppImage = ({
  src,
  alt,
  variant = "photo",
  sizes,
  priority = false,
  fit,
  aspectRatio,
  fallback,
  className,
}: AppImageProps) => {
  const preset = APP_IMAGE_PRESETS[variant];
  const ratio = aspectRatio ?? preset.aspectRatio;
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(src ? "loading" : "error");
  const showFallback = status === "error" || !src;

  return (
    <div
      className={cn("relative overflow-hidden bg-gray-100", className)}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      {!showFallback && status === "loading" && <div className="skeleton absolute inset-0" aria-hidden />}
      {showFallback ? (
        (fallback ?? <AppImageFallback variant={variant} />)
      ) : (
        // next/image는 CDN+옵티마이저 전환 뒤 적용. 그 전엔 302/서명 URL을 plain img로 따라간다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          sizes={sizes ?? preset.sizes}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className={cn(
            "absolute inset-0 size-full transition-opacity duration-300",
            (fit ?? preset.fit) === "contain" ? "object-contain" : "object-cover",
            status === "loaded" ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run --project storybook -t AppImage`
Expected: PASS (Loaded, ErrorFallsBack, NullSrcIsImmediatelyFallback, 기존 Fallback\*)

- [ ] **Step 5: 타입·린트**

Run: `npm run typecheck && npx eslint components/ui/app-image.tsx components/ui/app-image-fallback.tsx`
Expected: 통과

- [ ] **Step 6: 커밋**

```bash
git add components/ui/app-image.tsx components/ui/app-image.stories.tsx
git commit -m "feat(image): AppImage 상태 머신(스켈레톤·페이드·폴백·CLS)"
```

---

## Task 4: 첫 소비자 — CardTile 교체

**Files:**
- Modify: `components/card-tile.tsx`

- [ ] **Step 1: 교체 전 현행 확인**

`components/card-tile.tsx`를 읽는다. 이미지 블록(`aspect-[63/88]` 박스 + `<img>` + `imagePath===null` 실루엣 폴백 + `artworkCount` 배지)을 파악.

- [ ] **Step 2: 이미지 블록을 `<AppImage>`로 교체**

이미지 `<img>`/실루엣 분기를 `<AppImage variant="card">`로 대체하고, 카드 고유 폴백(set/number + 몬스터볼)은 `fallback` prop으로 넘긴다. `artworkCount` 배지는 박스 바깥 래퍼에 유지. **src는 직접 경로를 재조립하지 말고 기존 `cardImageUrl(imagePath, lang)`(`@/lib/card-image`)를 그대로 쓴다 — `lang`(ko/ja) 처리를 보존해야 함.** `lang`은 이미 `CardTileData`에 있고 구조분해돼 있다.

```tsx
<AppImage
  variant="card"
  src={imagePath ? cardImageUrl(imagePath, lang) : null}
  alt={`${nameKo} 카드`}
  className="rounded-xl border border-border"
  fallback={
    <div className="flex size-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
      <PokeballMark className="pointer-events-none absolute -bottom-4 -right-4 size-20 opacity-[0.1]" />
      <span className="tabular text-center text-sm font-bold leading-snug text-ink-600">
        {setCode}
        <br />
        {collectorNumber}
      </span>
    </div>
  }
/>
```

- [ ] **Step 3: 타입·린트·기존 스토리/테스트**

Run: `npm run typecheck && npx eslint components/card-tile.tsx && npx vitest run --project storybook`
Expected: 통과(깨진 참조 없음)

- [ ] **Step 4: 시각 확인(선택)**

dev 서버에서 `/search` 랜딩(둘러보기 격자) 열어 로딩 스켈레톤 → 폴백(현재 카드이미지 404라 폴백이 보임) 확인.

- [ ] **Step 5: 커밋**

```bash
git add components/card-tile.tsx
git commit -m "refactor(image): CardTile을 AppImage로 — 스켈레톤·폴백 적용"
```

---

## Task 5: 나머지 raw `<img>` 교체

**Files (각각 수정):** `components/card-image-zoom.tsx`, `components/ArtworkItem.tsx`, `components/artist-reviews.tsx`, `components/profile-edit.tsx`, `components/post-form.tsx`, `components/spec-info.tsx`, `components/admin/NewArtworkForm.tsx`, `app/ranking/page.tsx`, `app/community/[id]/page.tsx`, `app/community/reviews/page.tsx`, `app/artworks/[id]/page.tsx`, `app/artist/(studio)/StudioArtworks.tsx`, `domains/artwork/components/artwork-card.tsx`

각 파일마다 아래를 반복(파일 1개 = 커밋 1개):

- [ ] **Step 1: 해당 `<img>`의 용도로 variant 선택**
  - 아바타/프로필 사진 → `variant="avatar"` (label에 이름 전달)
  - 작품 미리보기(상세/확대) → `variant="artwork"` + `aspectRatio` 지정(알고 있는 비율 또는 부모 비율)
  - 커뮤니티/후기 사진 → `variant="photo"`
  - 카드 → `variant="card"`
  - 업로드 **미리보기(blob: URL, 로컬 파일 선택)** → `variant` 맞추되 `priority`로 즉시 표시, 폴백 불필요한 UX면 그대로.

- [ ] **Step 2: `<img>`를 `<AppImage>`로 교체.** 레이아웃 치수는 바깥 박스 `className`으로 옮김(너비/높이).

- [ ] **Step 3: 타입·린트**

Run: `npm run typecheck && npx eslint <파일>`
Expected: 통과

- [ ] **Step 4: 커밋**

```bash
git add <파일>
git commit -m "refactor(image): <파일> AppImage 적용"
```

> 참고: 폼의 로컬 파일 미리보기(`URL.createObjectURL`)는 서버 이미지가 아니므로, 스켈레톤이 어색하면 `priority`로 두거나 해당 자리만 plain `<img>` 유지도 허용(과용 금지, 케이스별 판단).

---

## Task 6: 스토리 카탈로그 + 전체 검증

**Files:**
- Modify: `components/ui/app-image.stories.tsx`(variant 갤러리 스토리 추가)

- [ ] **Step 1: variant별 로딩/로드/실패 3상태 갤러리 스토리 추가**(autodocs 카탈로그용, `tags: ["autodocs"]`).

- [ ] **Step 2: 전체 테스트**

Run: `npm run lint && npm run typecheck && npm test`
Expected: lint/typecheck 통과, vitest — storybook 프로젝트 전부 PASS, node 프로젝트는 S3 비의존 테스트 PASS(S3 통합 4파일 실패는 기존 환경 이슈, 이 변경 무관).

- [ ] **Step 3: 잔여 raw `<img>` 점검**

Run: `grep -rn "<img" app components domains | grep -v node_modules`
Expected: 의도적으로 남긴 로컬 파일 미리보기 외엔 없음(남으면 사유 주석).

- [ ] **Step 4: 커밋**

```bash
git add components/ui/app-image.stories.tsx
git commit -m "test(image): AppImage variant 3상태 스토리 카탈로그"
```

---

## 완료 기준

- 모든 서버 이미지가 `<AppImage>`로 렌더: 로딩 중 스켈레톤, 실패 시 variant 폴백(깨진-아이콘 0), aspect 박스로 CLS 없음.
- `npm run lint && npm run typecheck` 통과, storybook 테스트 전부 PASS.
- `isOptimizable` 시임 존재 → CDN 전환 시 `OPTIMIZABLE_HOSTS` 채우고 내부 렌더러만 `next/image`로 바꾸면 최적화 활성(공개 API 불변).
