"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { isExcludedPath } from "@/lib/analytics/events";

// 클라 행동 트래커 (설계 Phase 1). page_view / page_leave(체류) / click(data-track 라벨)을
// sendBeacon으로 /api/events에 보낸다. vid는 httpOnly라 서버가 찍는다 — 여기선 type·payload만.
// 어드민/작가 경로는 전송하지 않는다(서버도 한 번 더 막는다).

function send(body: Record<string, unknown>) {
  try {
    const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
    navigator.sendBeacon("/api/events", blob);
  } catch {
    // 측정 실패는 조용히 무시
  }
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const currentPath = useRef<string | null>(null);
  const enteredAt = useRef(0);

  // 경로 전환: 이전 페이지 체류 flush → 새 페이지 뷰
  useEffect(() => {
    if (isExcludedPath(pathname)) {
      currentPath.current = null;
      return;
    }
    if (currentPath.current && currentPath.current !== pathname) {
      send({ type: "page_leave", path: currentPath.current, dwell_ms: Date.now() - enteredAt.current });
    }
    currentPath.current = pathname;
    enteredAt.current = Date.now();
    send({ type: "page_view", path: pathname, ref: typeof document !== "undefined" ? document.referrer || null : null });
  }, [pathname]);

  // 탭을 숨기거나 닫을 때 체류 flush (SPA 이동은 위 effect가 처리).
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && currentPath.current) {
        send({ type: "page_leave", path: currentPath.current, dwell_ms: Date.now() - enteredAt.current });
        enteredAt.current = Date.now(); // 다시 보이면 체류 재계산
      }
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  // 큐레이트 클릭: [data-track="라벨"] 요소만 위임 수집.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-track]");
      const label = el?.getAttribute("data-track");
      const path = currentPath.current;
      if (!label || !path) return;
      send({ type: "click", path, label });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
