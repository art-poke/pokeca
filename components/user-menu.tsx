"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, LogOut, Palette, User } from "lucide-react";
import Link from "next/link";
import { logout } from "@/app/artist/actions";
import { cn } from "@/lib/utils";

const itemCls =
  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-700 outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100 data-[highlighted]:bg-gray-100";

export const UserMenu = ({
  name,
  handle,
  approved,
  registered,
}: {
  name: string;
  handle: string | null;
  approved: boolean;
  registered: boolean;
}) => {
  const initial = name.trim()[0] ?? "작";
  const statusLabel = !registered ? "작가 신청 전" : approved ? `@${handle}` : "승인 대기 중";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="inline-flex items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-2.5 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-ring/40">
        <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
          {initial}
        </span>
        <span className="hidden max-w-[8rem] truncate sm:inline">{name}</span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[13rem] rounded-xl border border-border bg-popover p-1.5 shadow-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
        >
          <div className="px-2.5 pb-1.5 pt-1">
            <div className="truncate text-sm font-semibold text-foreground">{name}</div>
            <div className="truncate text-xs text-muted-foreground">{statusLabel}</div>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild>
            <Link href={registered ? "/artist" : "/artist/signup"} className={itemCls}>
              <Palette className="size-4" aria-hidden />
              {registered ? "내 스튜디오" : "작가 신청"}
            </Link>
          </DropdownMenu.Item>
          {approved && handle && (
            <DropdownMenu.Item asChild>
              <Link href={`/artists/${handle}`} className={itemCls}>
                <User className="size-4" aria-hidden />
                내 작가 페이지
              </Link>
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild>
            <form action={logout}>
              <button type="submit" className={cn(itemCls, "text-destructive hover:bg-red-50")}>
                <LogOut className="size-4" aria-hidden />
                로그아웃
              </button>
            </form>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
