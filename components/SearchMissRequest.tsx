"use client";

import { useState } from "react";
import { useCreateSearchRequestMutation } from "@/domains/search-request/hooks";
import styles from "./SearchMissRequest.module.css";

type Phase = "idle" | "sending" | "done" | "failed";

// 검색 결과 없음의 찾기 요청 (design 6A). 노랑은 찾기 요청 영역에만 쓴다(DESIGN.md).
export function SearchMissRequest({ query, label }: { query: string; label: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const { mutate } = useCreateSearchRequestMutation();

  function send() {
    setPhase("sending");
    mutate(query, {
      onSuccess: () => setPhase("done"),
      onError: () => setPhase("failed"),
    });
  }

  return (
    <div className={styles.request}>
      {phase === "done" ? (
        <p className={styles.done} role="status">
          요청이 기록됐어요 · 카드가 추가되면 검색에 나와요
        </p>
      ) : (
        <>
          <p>목록에 없는 카드라면 알려 주세요. 카드를 추가할 때 참고해요.</p>
          <button type="button" className={styles.button} disabled={phase === "sending"} onClick={send}>
            {phase === "sending" ? "기록 중…" : label}
          </button>
          {phase === "failed" && <p role="alert">기록하지 못했어요. 다시 시도해 주세요.</p>}
        </>
      )}
    </div>
  );
}
