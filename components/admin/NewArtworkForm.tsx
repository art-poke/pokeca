"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FORMAT_INFO, FORMATS, type Format } from "@/lib/formats";
import { errorMessage, uploadFile } from "./upload";
import styles from "@/app/admin/admin.module.css";

// 작품 등록 (design 11A): 카드 찾기 → 규격 → 파일 → 출처 → 허락.
// 모든 작품은 사이트에 보관한다. 원본은 필수, 미리보기는 비워 두면 서버가 원본에서 만든다.
// 작품 ID는 폼을 열 때 만든다. 저장이 중간에 실패해 다시 눌러도 같은 작품이 된다(서버 멱등).
// mode "artist"는 승인된 작가가 자기 도안을 올리는 화면이다: 작가 이름은 계정 이름, 허락 근거 없음, 바로 공개.

type Card = { cardId: string; label: string; name: string; setName: string };
type Uploaded = { file: File; uploadId: string };

export function NewArtworkForm({ mode = "admin" }: { mode?: "admin" | "artist" }) {
  const artist = mode === "artist";
  const api = artist ? "/api/artist" : "/api/admin";
  const router = useRouter();
  const [id] = useState(() => crypto.randomUUID());
  const [cards, setCards] = useState<Card[] | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploaded = useRef<Partial<Record<"original" | "thumbnail" | "evidence", Uploaded>>>({});

  async function findCards(q: string) {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`${api}/cards?q=${encodeURIComponent(q)}`);
      const hits: Card[] = res.ok ? await res.json() : [];
      setCards(hits);
      if (hits.length === 1) setCard(hits[0]);
    } finally {
      setSearching(false);
    }
  }

  async function upload(kind: "original" | "thumbnail" | "evidence", file: File | null) {
    if (!file || file.size === 0) return undefined;
    const prev = uploaded.current[kind];
    if (prev && prev.file === file) return prev.uploadId;
    setSaving({ original: "원본 올리는 중…", thumbnail: "미리보기 올리는 중…", evidence: "허락 근거 올리는 중…" }[kind]);
    const uploadId = await uploadFile(kind, file, api);
    uploaded.current[kind] = { file, uploadId };
    return uploadId;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    if (!card) return setError("카드를 먼저 골라 주세요.");
    const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
    const originalFile = form.get("original") as File | null;
    if (!originalFile || originalFile.size === 0) return setError("원본 파일을 골라 주세요.");
    if (form.get("consent") !== "on") {
      return setError(
        artist
          ? "내가 만든 도안이고 사이트 보관·다운로드에 동의하는지 확인해 주세요."
          : "작가에게 사이트 보관·다운로드 허락을 받았는지 확인해 주세요.",
      );
    }

    try {
      const original = await upload("original", originalFile);
      const thumbnail = await upload("thumbnail", form.get("thumbnail") as File | null);
      const evidence = artist ? undefined : await upload("evidence", form.get("evidence") as File | null);
      setSaving("저장 중…");
      const res = await fetch(`${api}/artworks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          cardId: card.cardId,
          artistName: form.get("artistName"),
          title: form.get("title"),
          format: form.get("format"),
          sourceUrl: sourceUrl || null,
          sourceVisibility: sourceUrl ? form.get("sourceVisibility") : null,
          printSizeVerified: form.get("printSizeVerified") === "on",
          uploads: { original, thumbnail, evidence },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.code ?? "failed");
      router.push(artist ? "/artist?uploaded=1" : `/admin/artworks/${body.id}`);
    } catch (e) {
      setError(errorMessage(e instanceof Error ? e.message : ""));
      setSaving(null);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.fieldset}>
        <legend>1. 카드</legend>
        <div className={styles.row}>
          <label className="visually-hidden" htmlFor="card-q">
            카드 번호 또는 이름
          </label>
          <input
            id="card-q"
            className={`${styles.input} ${styles.short}`}
            placeholder="sv2a 201/165"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                findCards(e.currentTarget.value);
              }
            }}
          />
          <button
            type="button"
            className={styles.secondary}
            disabled={searching}
            onClick={(e) => findCards((e.currentTarget.previousElementSibling as HTMLInputElement).value)}
          >
            {searching ? "찾는 중…" : "카드 찾기"}
          </button>
        </div>
        {cards && cards.length === 0 && <p className={styles.muted}>맞는 카드가 없어요.</p>}
        {cards && cards.length > 0 && (
          <ul className={styles.candidates} aria-label="카드 후보">
            {cards.map((c) => (
              <li key={c.cardId}>
                <button
                  type="button"
                  className={styles.candidateButton}
                  aria-pressed={card?.cardId === c.cardId}
                  onClick={() => setCard(c)}
                >
                  <strong>{c.label}</strong> {c.name} <span className={styles.muted}>· {c.setName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {card && (
          <p role="status">
            선택한 카드: <strong>{card.label}</strong> {card.name}
          </p>
        )}
      </fieldset>

      {!artist && (
        <label className={styles.field}>
          <span>작가 이름(닉네임)</span>
          <input name="artistName" required maxLength={80} className={styles.input} />
        </label>
      )}

      <label className={styles.field}>
        <span>도안 제목 (선택)</span>
        <span>비워 두면 “{"{작가}"}님의 도안”으로 보여요.</span>
        <input name="title" maxLength={120} className={styles.input} placeholder="예: 리자몽 9포켓 풀아트" />
      </label>

      <fieldset className={styles.fieldset}>
        <legend>2. 규격</legend>
        <div className={styles.row}>
          {FORMATS.map((f: Format, i) => (
            <label key={f} className={styles.check}>
              <input type="radio" name="format" value={f} required defaultChecked={i === 0} />
              {FORMAT_INFO[f].label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>3. 파일</legend>
        <label className={styles.field}>
          <span>원본 파일 (필수)</span>
          <span>방문자가 받아 인쇄하는 파일이에요. PNG·JPEG·PDF, 100 MB까지</span>
          <input name="original" type="file" required accept="image/png,image/jpeg,application/pdf" />
        </label>
        <label className={styles.field}>
          <span>미리보기 (선택)</span>
          <span>비워 두면 원본에서 자동으로 만들어요. PDF 원본이면 PNG·JPEG로 꼭 올려 주세요.</span>
          <input name="thumbnail" type="file" accept="image/png,image/jpeg" />
        </label>
        <label className={styles.check}>
          <input type="checkbox" name="printSizeVerified" />
          {artist ? "규격 인쇄 치수에 맞춰 만들었어요" : "파일 치수를 직접 확인함"} (방문자에게 인쇄 치수를 안내)
        </label>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>4. 출처 (선택)</legend>
        <label className={styles.field}>
          <span>{artist ? "이 도안을 처음 올린 글 주소" : "작가가 처음 올린 글 주소"}</span>
          <span>
            {artist
              ? "카페·SNS에 올린 글이 있으면 도안 옆에 출처 링크로 보여 줘요."
              : "도안 옆에 출처 링크로 보여 줘요. 파일만 받았다면 비워 두세요."}
          </span>
          <input name="sourceUrl" type="url" placeholder="https://cafe.naver.com/…" className={styles.input} />
        </label>
        <div className={styles.row}>
          <label className={styles.check}>
            <input type="radio" name="sourceVisibility" value="public" defaultChecked />
            누구나 볼 수 있음
          </label>
          <label className={styles.check}>
            <input type="radio" name="sourceVisibility" value="members_only" />
            카페 회원 전용
          </label>
        </div>
      </fieldset>

      {artist ? (
        <fieldset className={styles.fieldset}>
          <legend>5. 동의</legend>
          <label className={styles.check}>
            <input type="checkbox" name="consent" required />
            내가 만든 도안이고, 사이트에 보관해 방문자가 미리보기·다운로드하는 것에 동의해요
          </label>
          <p className={styles.hint}>올리면 바로 카드 페이지와 내 작가 페이지에 공개돼요. 내 도안 목록에서 언제든 내릴 수 있어요.</p>
        </fieldset>
      ) : (
        <fieldset className={styles.fieldset}>
          <legend>5. 아티스트 허락</legend>
          <label className={styles.check}>
            <input type="checkbox" name="consent" required />
            사이트에 파일을 보관하고 방문자가 미리보기·다운로드하는 것을 허락받았어요
          </label>
          <label className={styles.field}>
            <span>허락 근거 (선택)</span>
            <span>아티스트 DM 캡처 등. PNG·JPEG·PDF, 20 MB까지. 어드민만 볼 수 있어요.</span>
            <input name="evidence" type="file" accept="image/png,image/jpeg,application/pdf" />
          </label>
        </fieldset>
      )}

      <div role="status">
        {error && <p className={styles.error}>{error}</p>}
        {saving && <p className={styles.ok}>{saving}</p>}
      </div>
      <div>
        <button type="submit" className={styles.primary} disabled={!!saving}>
          {artist ? "올리기" : "등록"}
        </button>
      </div>
    </form>
  );
}
