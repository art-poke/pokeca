"use client";
import { useEffect, useRef } from "react";
export function LoginOrigin({ source }: { source?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("art_origin") ?? "{}";
      const value = JSON.parse(raw);
      if (ref.current && Date.now() - value.time < 120000)
        ref.current.value = raw;
      sessionStorage.removeItem("art_origin");
    } catch {}
  }, []);
  return (
    <input
      type="hidden"
      ref={ref}
      name="origin"
      defaultValue={JSON.stringify({
        page: source ?? "social_login",
        action: "direct_route",
        placement: "direct",
      })}
    />
  );
}
