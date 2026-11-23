"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { actions, pageId } from "./taxonomy";

function session() {
  const previous = document.cookie.match(
    /(?:^|; )art_session=([0-9a-f-]{36})(?:;|$)/,
  )?.[1];
  const fresh = !previous;
  const id = fresh ? crypto.randomUUID() : previous;

  document.cookie =
    "art_session=" +
    id +
    "; Path=/; Max-Age=1800; SameSite=Lax" +
    (location.protocol === "https:" ? "; Secure" : "");
  const landing = !document.cookie
    .split("; ")
    .includes("art_landing_session=" + id);
  document.cookie =
    "art_landing_session=" +
    id +
    "; Path=/; Max-Age=1800; SameSite=Lax" +
    (location.protocol === "https:" ? "; Secure" : "");
  return landing;
}

export function signal(type: string, detail: Record<string, string> = {}) {
  try {
    const page = pageId(location.pathname);
    if (!page) return;
    const first = session();
    const url = new URL(location.href);
    const ref = document.referrer && new URL(document.referrer).hostname;
    const payload = {
      type,
      page,
      eventId: crypto.randomUUID(),
      ...detail,
      ...(first && {
        landing: "yes",
        ref: ref === location.hostname ? "" : ref,
        source: url.searchParams.get("utm_source"),
        medium: url.searchParams.get("utm_medium"),
        campaign: url.searchParams.get("utm_campaign"),
      }),
    };
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    if (!navigator.sendBeacon?.("/api/events", blob))
      void fetch("/api/events", {
        method: "POST",
        body: blob,
        keepalive: true,
      }).catch(() => {});
  } catch {
    /* Storage and measurement are optional. */
  }
}

export function AnalyticsTracker() {
  const path = usePathname();
  const last = useRef("");
  useEffect(() => {
    const visible = () => {
      if (document.hidden || last.current === path) return;
      last.current = path;
      signal("page_view");
    };
    visible();
    document.addEventListener("visibilitychange", visible);
    if (!pageId(path))
      return () => document.removeEventListener("visibilitychange", visible);
    let readRemaining = 10000;
    let readingSince = 0;
    let readTimer: ReturnType<typeof setTimeout> | undefined;
    const reading = () => {
      if (pageId(path) !== "story_detail" || readRemaining <= 0) return;
      clearTimeout(readTimer);
      if (readingSince) readRemaining -= Date.now() - readingSince;
      readingSince = document.hidden ? 0 : Date.now();
      if (readingSince)
        readTimer = setTimeout(
          () => {
            readRemaining = 0;
            signal("story_read");
          },
          Math.max(0, readRemaining),
        );
    };
    reading();
    document.addEventListener("visibilitychange", reading);
    const seen = new Set<Element>();
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          clearTimeout(timers.get(el));
          if (entry.intersectionRatio < 0.5 || seen.has(el)) continue;
          timers.set(
            el,
            setTimeout(() => {
              if (document.hidden || !el.isConnected) return;
              seen.add(el);
              signal("cta_impression", {
                action: el.dataset.track!,
                placement: el.dataset.place ?? "content",
              });
            }, 1000),
          );
        }
      },
      { threshold: [0, 0.5] },
    );
    const observe = (root: ParentNode) =>
      root
        .querySelectorAll("[data-track]")
        .forEach((el) => observer.observe(el));
    observe(document);
    const changes = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (node instanceof HTMLElement) {
            if (node.hasAttribute("data-track")) observer.observe(node);
            observe(node);
          }
    });
    changes.observe(document.body, { childList: true, subtree: true });
    function click(e: Event) {
      const el =
        e.target instanceof Element
          ? e.target.closest<HTMLElement>("[data-track]")
          : null;
      const action = el?.dataset.track;
      if (!el || !action || !actions.has(action)) return;
      const placement = el.dataset.place ?? "content";
      signal("cta_clicked", { action, placement });
      if (
        el.matches(
          'a[href="/artist/login"],a[href^="/artist/new"],a[href="/play"],a[href^="/card-fragments/"],a[href="/community/new"]',
        )
      ) {
        try {
          sessionStorage.setItem(
            "art_origin",
            JSON.stringify({
              page: pageId(path),
              action,
              placement,
              time: Date.now(),
            }),
          );
        } catch {}
      }
    }
    document.addEventListener("click", click, true);
    return () => {
      document.removeEventListener("click", click, true);
      document.removeEventListener("visibilitychange", visible);
      clearTimeout(readTimer);
      document.removeEventListener("visibilitychange", reading);
      changes.disconnect();
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [path]);
  return null;
}
