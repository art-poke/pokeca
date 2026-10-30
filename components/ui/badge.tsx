import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

// 뱃지: 규격(9포켓/PSA/BRG)·레어도·상태 라벨용
const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        primary: "border-transparent bg-red-600 text-white",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        soft: "border-transparent bg-accent text-accent-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "muted",
    },
  },
);

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
  };

export const Badge = ({ className, variant, asChild = false, ...props }: BadgeProps) => {
  const Comp = asChild ? Slot : "span";
  return <Comp className={cn(badgeVariants({ variant, className }))} {...props} />;
};

export { badgeVariants };
export type { BadgeProps };
