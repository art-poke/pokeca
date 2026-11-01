"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAttachArtworkFileMutation,
  useUpdateArtworkMutation,
} from "@/domains/admin/hooks";
import { errorMessage, uploadFile } from "./upload";
import styles from "@/app/admin/admin.module.css";

// 작품 상세의 변경 폼 (design 11A, eng E1).
// 숨김·복구는 되돌릴 수 있어 바로 실행하고, 철회는 카드 번호를 입력해야 실행된다.
// 서버도 같은 확인을 다시 한다(PATCH /api/admin/artworks/[id]의 confirm).

type Props = {
  id: string;
  cardNumber: string; // 예: "sv2a 201/165"
  status: "active" | "hidden" | "withdrawn";
};

type Pending = { body: Record<string, unknown>; title: string; detail: string } | null;

const normalize = (s: string) => s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");

export function ArtworkControls(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState<Pending>(null);
  const evidenceInput = useRef<HTMLInputElement>(null);
  // 같은 근거 파일로 다시 저장하면 다시 올리지 않는다(확인 실패 후 재시도 등).
  const evidenceUpload = useRef<{ file: File; uploadId: string } | null>(null);
  const { mutateAsync: updateArtwork } = useUpdateArtworkMutation(props.id);
  const { mutateAsync: attachFile } = useAttachArtworkFileMutation(props.id);

  async function patch(body: Record<string, unknown>, evidence?: File) {
    setBusy(true);
    setMessage(null);
    try {
      if (evidence) {
        if (evidenceUpload.current?.file !== evidence) {
          evidenceUpload.current = { file: evidence, uploadId: await uploadFile("evidence", evidence) };
        }
        body = { ...body, evidenceUploadId: evidenceUpload.current.uploadId };
      }
      const data = await updateArtwork(body);
      setMessage({
        ok: true,
        text: data.purged === false ? "저장했어요. 파일 삭제는 정리 작업이 다시 시도해요." : "저장했어요.",
      });
      if (evidence && evidenceInput.current) evidenceInput.current.value = "";
      router.refresh();
      return true;
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e instanceof Error ? e.message : "") });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function attach(kind: "original" | "thumbnail", file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const uploadId = await uploadFile(kind, file);
      await attachFile({ kind, uploadId });
      setMessage({ ok: true, text: kind === "original" ? "원본을 바꾸고 미리보기를 새로 만들었어요." : "미리보기를 바꿨어요." });
      router.refresh();
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e instanceof Error ? e.message : "") });
    } finally {
      setBusy(false);
    }
  }

  async function submitEvidence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("evidence") as File | null;
    if (!file || file.size === 0) return setMessage({ ok: false, text: "근거 파일을 골라 주세요." });
    await patch({ action: "evidence", reason: form.get("reason") || undefined }, file);
  }

  if (props.status === "withdrawn") {
    return <p className={styles.muted}>철회한 작품이라 더 바꿀 수 없어요.</p>;
  }

  return (
    <>
      <div role="status">{message && <p className={message.ok ? styles.ok : styles.error}>{message.text}</p>}</div>

      <section className={styles.section} aria-labelledby="status-heading">
        <h2 id="status-heading" className={styles.subtitle}>
          공개 상태
        </h2>
        <p>
          지금: <strong>{props.status === "active" ? "공개" : "숨김"}</strong>
        </p>
        <div>
          {props.status === "active" ? (
            <button type="button" className={styles.secondary} disabled={busy} onClick={() => patch({ action: "hide" })}>
              숨기기
            </button>
          ) : (
            <button type="button" className={styles.secondary} disabled={busy} onClick={() => patch({ action: "restore" })}>
              다시 공개
            </button>
          )}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="consent-heading">
        <h2 id="consent-heading" className={styles.subtitle}>
          허락 근거 추가
        </h2>
        <form className={styles.form} onSubmit={submitEvidence}>
          <label className={styles.field}>
            <span>근거 파일</span>
            <span>아티스트 DM 캡처 등. PNG·JPEG·PDF, 20 MB까지. 어드민만 볼 수 있어요.</span>
            <input ref={evidenceInput} name="evidence" type="file" accept="image/png,image/jpeg,application/pdf" />
          </label>
          <label className={styles.field}>
            <span>메모</span>
            <input name="reason" className={styles.input} placeholder="예: 아티스트 DM 허락 (10/28)" />
          </label>
          <div>
            <button type="submit" className={styles.primary} disabled={busy}>
              근거 저장
            </button>
          </div>
        </form>
      </section>

      <section className={styles.section} aria-labelledby="files-heading">
        <h2 id="files-heading" className={styles.subtitle}>
          파일 바꾸기
        </h2>
        <p className={styles.muted}>
          새 파일로 바뀌고 이전 파일은 지워져요. 원본을 바꾸면 미리보기도 새로 만들어요(PDF 원본이면 미리보기를 직접 올려 주세요).
        </p>
        <label className={styles.field}>
          <span>원본</span>
          <input type="file" accept="image/png,image/jpeg,application/pdf" disabled={busy} onChange={(e) => attach("original", e.currentTarget.files?.[0])} />
        </label>
        <label className={styles.field}>
          <span>미리보기</span>
          <input type="file" accept="image/png,image/jpeg" disabled={busy} onChange={(e) => attach("thumbnail", e.currentTarget.files?.[0])} />
        </label>
      </section>

      <section className={styles.dangerZone} aria-labelledby="danger-heading">
        <h2 id="danger-heading" className={styles.subtitle}>
          철회
        </h2>
        <p>목록에서 영구히 내리고 보관 중인 파일을 모두 지워요. 되돌릴 수 없어요.</p>
        <div>
          <button
            type="button"
            className={styles.danger}
            disabled={busy}
            onClick={() =>
              setConfirming({ body: { action: "withdraw" }, title: "작품 철회", detail: "파일이 삭제되며 되돌릴 수 없어요." })
            }
          >
            철회…
          </button>
        </div>
      </section>

      <ConfirmDialog
        pending={confirming}
        cardNumber={props.cardNumber}
        busy={busy}
        onCancel={() => setConfirming(null)}
        onConfirm={async (confirm) => {
          if (confirming && (await patch({ ...confirming.body, confirm }))) setConfirming(null);
        }}
      />
    </>
  );
}

// 카드 번호를 그대로 입력해야 실행 버튼이 켜진다 (design 11A).
function ConfirmDialog({
  pending,
  cardNumber,
  busy,
  onCancel,
  onConfirm,
}: {
  pending: Pending;
  cardNumber: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (confirm: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (pending && !dialog.open) dialog.showModal();
    if (!pending && dialog.open) dialog.close();
  }, [pending]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="confirm-title"
      onClose={() => {
        setTyped("");
        onCancel();
      }}
    >
      {pending && (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(typed);
          }}
        >
          <h2 id="confirm-title" className={styles.subtitle}>
            {pending.title}
          </h2>
          <p>{pending.detail}</p>
          <label className={styles.field}>
            <span>
              확인을 위해 카드 번호 <strong>{cardNumber}</strong>를 입력하세요
            </span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} className={styles.input} autoComplete="off" />
          </label>
          <div className={styles.row}>
            <button type="button" className={styles.secondary} onClick={() => ref.current?.close()}>
              취소
            </button>
            <button type="submit" className={styles.danger} disabled={busy || normalize(typed) !== normalize(cardNumber)}>
              {pending.title} 실행
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
