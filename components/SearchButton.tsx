"use client";

import { useFormStatus } from "react-dom";

// 검색하는 동안 버튼 안에 진행 표시를 띄운다 (design 6A). 이전 결과는 새 결과가 올 때까지 그대로 남는다.
export function SearchButton({ className }: { className: string }) {
  const { pending } = useFormStatus();
  return (
    <button data-track="submit_search" type="submit" className={className} aria-disabled={pending || undefined}>
      {pending ? "찾는 중…" : "찾기"}
    </button>
  );
}
