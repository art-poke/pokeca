import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor, within } from "storybook/test";
import { AppImage } from "./app-image";
import { AppImageFallback } from "./app-image-fallback";

const OK_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const meta = {
  title: "Atoms/AppImage",
  component: AppImageFallback,
  tags: ["autodocs"],
} satisfies Meta<typeof AppImageFallback>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FallbackCard: Story = {
  args: { variant: "card" },
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
  args: { variant: "avatar", label: "별빛" },
  render: () => (
    <div className="size-12">
      <AppImageFallback variant="avatar" label="별빛" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent).toContain("별");
  },
};

export const Loaded: StoryObj = {
  render: () => (
    <div className="w-40">
      <AppImage variant="card" src={OK_SRC} alt="로드 성공" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const img = canvasElement.querySelector("img") as HTMLImageElement;
    await expect(img).toBeTruthy();
    // onLoad→setStatus('loaded')는 React 비동기 리렌더라, img.complete보다 늦을 수 있다.
    // 고정 대기 대신 waitFor로 페이드인(opacity-100) 적용을 폴링한다.
    await waitFor(() => expect(img.className).toContain("opacity-100"));
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

// variant × 상태(로드/실패) 카탈로그. autodocs에 표로 노출된다.
const VARIANTS = [
  { v: "card", ratio: undefined, w: "w-28" },
  { v: "avatar", ratio: undefined, w: "w-12" },
  { v: "artwork", ratio: "3 / 4", w: "w-28" },
  { v: "photo", ratio: undefined, w: "w-40" },
] as const;

export const VariantGallery: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-6">
      {VARIANTS.map(({ v, ratio, w }) => (
        <div key={v} className="space-y-2">
          <p className="text-xs font-semibold text-ink-600">{v}</p>
          <div className={w}>
            <AppImage variant={v} aspectRatio={ratio} src={OK_SRC} alt={`${v} 로드`} />
          </div>
          <div className={w}>
            <AppImage variant={v} aspectRatio={ratio} src="/__nope__.png" alt={`${v} 실패`} />
          </div>
        </div>
      ))}
    </div>
  ),
};
