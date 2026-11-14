import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
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
