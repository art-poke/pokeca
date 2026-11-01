"use client";

import { useState } from "react";
import { useCreateReportMutation } from "@/domains/report/hooks";
import type { ReportInput } from "@/domains/report/api/types";
import { isApiError } from "@/lib/api/errors";
import styles from "./ReportForm.module.css";

// 신고·내림 요청 폼 (design 14A, 6A). 작품 ··· 메뉴의 대화상자와 /takedown 페이지가 함께 쓴다.
// 작품이 정해지지 않았으면(푸터 경로) 원본 URL을 받는다.
const REASONS = [
  { value: "rights_holder", label: "권리자 또는 본인 요청" },
  { value: "suspected_theft", label: "도용 의심" },
  { value: "other", label: "기타" },
] as const;

type State = "idle" | "sending" | "sent" | "failed" | "limited";

export function ReportForm({ artworkId, onDone }: { artworkId?: string; onDone?: () => void }) {
  const [state, setState] = useState<State>("idle");
  const { mutate } = useCreateReportMutation();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setState("sending");
    mutate(
      { ...data, artworkId } as ReportInput,
      {
        onSuccess: () => setState("sent"),
        onError: (error) =>
          // 입력은 그대로 둔다. 하루 한도(429)는 별도 안내.
          setState(isApiError(error) && error.status === 429 ? "limited" : "failed"),
      },
    );
  }

  if (state === "sent") {
    return (
      <div className={styles.sent} role="status">
        <p>신고가 접수됐어요. 확인 후 처리할게요.</p>
        {onDone && (
          <button type="button" className={styles.secondary} onClick={onDone}>
            닫기
          </button>
        )}
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>사유</legend>
        {REASONS.map((r, i) => (
          <label key={r.value} className={styles.radio}>
            <input type="radio" name="reason" value={r.value} required defaultChecked={i === 0} />
            {r.label}
          </label>
        ))}
      </fieldset>
      {!artworkId && (
        <label className={styles.field}>
          <span>원본 글 또는 도안 주소</span>
          <input name="sourceUrl" type="url" required placeholder="https://" className={styles.input} />
        </label>
      )}
      <label className={styles.field}>
        <span>
          연락처 <span className={styles.optional}>(선택)</span>
        </span>
        <input name="contact" type="text" maxLength={200} className={styles.input} autoComplete="email" />
      </label>
      <label className={styles.field}>
        <span>
          내용 <span className={styles.optional}>(선택)</span>
        </span>
        <textarea name="message" rows={3} maxLength={2000} className={styles.input} />
      </label>
      <div role="status" className={styles.feedback}>
        {state === "failed" && <p>보내지 못했어요. 다시 시도해 주세요.</p>}
        {state === "limited" && <p>오늘은 신고를 더 받을 수 없어요. 내일 다시 시도해 주세요.</p>}
      </div>
      <div className={styles.buttons}>
        {onDone && (
          <button type="button" className={styles.secondary} onClick={onDone}>
            취소
          </button>
        )}
        <button type="submit" className={styles.primary} disabled={state === "sending"}>
          {state === "sending" ? "보내는 중…" : "보내기"}
        </button>
      </div>
    </form>
  );
}
