"use client";

import {
  ChevronLeft,
  ChevronRight,
  Home,
  Megaphone,
  Menu,
  MessagesSquare,
  Palette,
  Search,
  ShieldAlert,
  Trophy,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { SearchBar } from "@/components/search-bar";
import { Logo, PokeballMark } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "홈", icon: Home },
  { href: "/search", label: "카드 검색", icon: Search },
  { href: "/ranking", label: "랭킹", icon: Trophy },
  { href: "/requests", label: "도안 요청해요", icon: Megaphone },
  { href: "/community", label: "커뮤니티", icon: MessagesSquare },
  { href: "/artist", label: "작가 스튜디오", icon: Palette },
  { href: "/takedown", label: "권리자 내림 요청", icon: ShieldAlert },
] as const;

// usePathname이 요청 데이터라 PPR에서 AppShell은 Suspense 안에 있어야 한다. 그 동안 보여줄 셸.
export const AppShellFallback = () => (
  <div className="min-h-dvh">
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background px-3 md:px-4">
      <span className="inline-flex items-center gap-2">
        <PokeballMark className="size-7" />
        <span className="font-display text-lg font-bold text-foreground">확장 아트 아카이브</span>
      </span>
    </header>
  </div>
);

const STORAGE_KEY = "art-poke:sidebar-collapsed";
const COLLAPSE_EVENT = "art-poke:sidebar-toggle";

// 사이드바 접힘 상태를 localStorage 외부 저장소로 구독한다(effect 내 setState 없이, SSR 기본 펼침).
const readCollapsed = () =>
  typeof localStorage === "undefined" ? false : localStorage.getItem(STORAGE_KEY) === "1";
const subscribeCollapsed = (cb: () => void) => {
  window.addEventListener(COLLAPSE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

const NavLinks = ({
  pathname,
  collapsed = false,
  onNavigate,
}: {
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) => (
  <nav className="flex w-full flex-col gap-1">
    {NAV.map(({ href, label, icon: Icon }) => {
      const active = isActive(pathname, href);
      return (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          title={collapsed ? label : undefined}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center rounded-xl text-sm font-semibold transition-colors",
            collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
            active
              ? "bg-accent text-accent-foreground"
              : "text-ink-600 hover:bg-gray-100 hover:text-foreground",
          )}
        >
          <Icon className="size-5 shrink-0" aria-hidden />
          {!collapsed && label}
        </Link>
      );
    })}
  </nav>
);

export const AppShell = ({
  children,
  auth,
}: {
  children: React.ReactNode;
  auth?: React.ReactNode;
}) => {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);

  const toggleCollapsed = () => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "0" : "1");
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  };

  // /search는 자체 큰 검색창이 주인공, 어드민·작가는 자체 폼이 있어 머리글 검색을 숨긴다.
  const studio = pathname === "/artist" || pathname.startsWith("/artist/");
  const showSearch = !(pathname.startsWith("/search") || pathname.startsWith("/admin") || studio);

  return (
    <div className="min-h-dvh">
      {/* 전역 헤더 (전체 폭): 로고 좌측 · 검색/로그인 우측 */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur md:px-4">
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-lg text-ink-700 transition-colors hover:bg-gray-100 lg:hidden"
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
        >
          <Menu className="size-6" />
        </button>
        <Link href="/" className="shrink-0" aria-label="확장 아트 아카이브 홈">
          <Logo />
        </Link>
        <div className="ml-auto flex items-center gap-3">
          {showSearch && (
            <div className="hidden w-64 md:block lg:w-80">
              <SearchBar variant="header" />
            </div>
          )}
          {auth}
        </div>
      </header>

      <div
        className={cn(
          "lg:grid",
          collapsed
            ? "lg:grid-cols-[72px_minmax(0,1fr)]"
            : "lg:grid-cols-[260px_minmax(0,1fr)]",
        )}
      >
        {/* 데스크톱 좌측 사이드바 (헤더 아래, 네비만) */}
        <aside
          className={cn(
            "sticky top-14 hidden h-[calc(100dvh-3.5rem)] flex-col border-r border-border bg-background lg:flex",
            collapsed ? "items-center px-2 py-4" : "p-4",
          )}
        >
          {/* 사이드바 경계선에 걸치는 접기 토글 */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="absolute -right-3 top-4 z-50 flex size-6 items-center justify-center rounded-full border border-border bg-background text-ink-500 shadow-sm transition-colors hover:border-gray-300 hover:text-foreground"
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
          <NavLinks pathname={pathname} collapsed={collapsed} />
          <Link
            href="/artist/new"
            title={collapsed ? "작가로 도안 올리기" : undefined}
            className={cn(
              "mt-auto flex items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground transition-colors hover:bg-red-600",
              collapsed ? "size-11" : "w-full px-4 py-3 text-sm",
            )}
          >
            <PokeballMark className="size-4" />
            {!collapsed && "작가로 도안 올리기"}
          </Link>
        </aside>

        {/* 본문 컬럼 */}
        <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col">
          <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-6 md:px-6 md:py-10">
            {children}
          </main>

          <footer className="border-t border-border bg-background">
            <div className="flex flex-col gap-3 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
              <p>비영리 팬 아카이브입니다. 도안의 권리는 각 아티스트에게 있습니다.</p>
              <p className="flex items-center gap-3">
                <Link href="/artist/login" className="hover:text-foreground">
                  작가로 도안 올리기
                </Link>
                <span aria-hidden className="text-gray-300">
                  ·
                </span>
                <Link href="/takedown" className="hover:text-foreground">
                  권리자 내림 요청
                </Link>
              </p>
            </div>
          </footer>
        </div>
      </div>

      {/* 모바일 드로어 */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink-900/40 animate-in fade-in"
            onClick={() => setOpen(false)}
            aria-label="메뉴 닫기"
          />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col bg-background p-4 shadow-md animate-in slide-in-from-left">
            <div className="mb-7 flex items-center justify-between px-2 py-1">
              <Logo />
              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-lg text-ink-700 hover:bg-gray-100"
                onClick={() => setOpen(false)}
                aria-label="메뉴 닫기"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mb-4">
              <SearchBar variant="header" />
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};
