import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./badge";

const meta = {
  title: "Atoms/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "soft", "muted", "outline"] },
  },
  args: { children: "SAR" },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: "primary" } };

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="primary">SAR</Badge>
      <Badge variant="secondary">9포켓</Badge>
      <Badge variant="soft">PSA</Badge>
      <Badge variant="muted">BRG</Badge>
      <Badge variant="outline">전체</Badge>
    </div>
  ),
};
