"use client";

import { Search, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SearchBar } from "./search-bar";

// 홈은 큰 검색창이 주인공이고, 어드민·작가 화면은 자체 카드 고르기 폼이 있어서 머리글 검색을 숨긴다.
export const HeaderSearch = () => {
  const pathname = usePathname();
  const studio = pathname === "/artist" || pathname.startsWith("/artist/");
  if (pathname === "/" || pathname.startsWith("/admin") || studio) return null;
  return <Collapsible key={pathname} />;
};

// 넓은 화면(md+)에서는 머리글 검색바가 항상 보이고, 모바일에서는 ⌕ 버튼으로 전체 폭 입력창을 펼친다.
const Collapsible = () => {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panel.current?.querySelector("input")?.focus();
  }, [open]);

  return (
    <>
      {/* 데스크톱: 인라인 검색바 */}
      <div className="hidden min-w-0 flex-1 justify-end md:flex">
        <div className="w-full max-w-sm">
          <SearchBar variant="header" />
        </div>
      </div>

      {/* 모바일: 토글 버튼 + 펼침 패널 */}
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center rounded-lg text-ink-700 transition-colors hover:bg-gray-100 md:hidden"
        aria-expanded={open}
        aria-controls="header-search"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-5" /> : <Search className="size-5" />}
        <span className="visually-hidden">카드 검색 {open ? "닫기" : "열기"}</span>
      </button>
      <div
        id="header-search"
        ref={panel}
        className={open ? "order-last w-full basis-full pb-3 md:hidden" : "hidden"}
      >
        <SearchBar variant="header" />
      </div>
    </>
  );
};
