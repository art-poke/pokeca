"use client";

import { FileText, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FORMAT_INFO, FORMATS, type Format } from "@/lib/formats";
import { cn } from "@/lib/utils";
import { errorMessage, uploadFile } from "./upload";

// 작품 등록: (좌) 카드·제목·규격 · (우) 파일 업로드+미리보기.
// mode "artist"는 승인 작가가 자기 도안을 올리는 화면(작가 이름=계정, 출처·허락 단계 없음, 바로 공개).

type Card = { cardId: string; label: string; name: string; setName: string };
type Uploaded = { file: File; uploadId: string };

const input =
  "h-11 w-full rounded-lg border border-input bg-background px-3.5 text-base text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";
const labelText = "text-sm font-semibold text-foreground";
const hint = "text-xs text-muted-foreground";
const checkRow = "flex items-center gap-2 text-sm text-ink-700";

// 파일 업로드 + 미리보기 드롭존. 이미지는 바로 미리보기, PDF는 아이콘.
function FileField({
  name,
  accept,
  label,
  hint: hintText,
}: {
  name: string;
  accept: string;
  label: string;
  hint: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);

  function handle(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFileName(file?.name ?? null);
    const pdf = file?.type === "application/pdf";
    setIsPdf(pdf);
    setPreview(file && !pdf ? URL.createObjectURL(file) : null);
  }

  function clear() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFileName(null);
    setIsPdf(false);
    if (ref.current) ref.current.value = "";
  }

  return (
    <div className="space-y-1.5">
      <span className={labelText}>{label}</span>
      <span className={cn("block", hint)}>{hintText}</span>
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f && ref.current) {
            const dt = new DataTransfer();
            dt.items.add(f);
            ref.current.files = dt.files;
            handle(f);
          }
        }}
        className="relative flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-gray-50 p-4 text-center transition-colors hover:border-primary"
      >
        <input
          ref={ref}
          type="file"
          name={name}
          accept={accept}
          className="sr-only"
          onChange={(e) => handle(e.target.files?.[0] ?? null)}
        />
        {preview ? (
          <img src={preview} alt="미리보기" className="max-h-56 w-auto rounded-lg object-contain" />
        ) : isPdf ? (
          <>
            <FileText className="size-8 text-ink-400" aria-hidden />
            <span className="text-sm font-medium text-ink-700">{fileName}</span>
          </>
        ) : (
          <>
            <UploadCloud className="size-8 text-ink-400" aria-hidden />
            <span className="text-sm font-medium text-ink-600">클릭하거나 파일을 끌어다 놓으세요</span>
          </>
        )}
        {fileName && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              clear();
            }}
            className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-background/90 text-ink-600 shadow-sm hover:text-destructive"
            aria-label="파일 지우기"
          >
            <X className="size-4" />
          </button>
        )}
      </label>
      {preview && fileName && <p className={hint}>{fileName}</p>}
    </div>
  );
}

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
    setSaving(
      { original: "원본 올리는 중…", thumbnail: "미리보기 올리는 중…", evidence: "허락 근거 올리는 중…" }[kind],
    );
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
    if (!artist && form.get("consent") !== "on") {
      return setError("작가에게 사이트 보관·다운로드 허락을 받았는지 확인해 주세요.");
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
    <form className="space-y-6" onSubmit={submit}>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 좌: 카드·제목·규격 */}
        <div className="space-y-5 rounded-2xl border border-border bg-background p-5">
          <div className="space-y-1.5">
            <span className={labelText}>카드</span>
            <div className="flex gap-2">
              <label className="visually-hidden" htmlFor="card-q">
                카드 번호 또는 이름
              </label>
              <input
                id="card-q"
                className={input}
                placeholder="sv2a 201/165 또는 리자몽"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    findCards(e.currentTarget.value);
                  }
                }}
              />
              <button
                type="button"
                className="h-11 shrink-0 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-ink-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
                disabled={searching}
                onClick={(e) =>
                  findCards((e.currentTarget.previousElementSibling as HTMLInputElement).value)
                }
              >
                {searching ? "찾는 중…" : "카드 찾기"}
              </button>
            </div>
            {cards && cards.length === 0 && <p className={hint}>맞는 카드가 없어요.</p>}
            {cards && cards.length > 0 && (
              <ul className="max-h-48 divide-y divide-border overflow-auto rounded-xl border border-border" aria-label="카드 후보">
                {cards.map((c) => (
                  <li key={c.cardId}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50",
                        card?.cardId === c.cardId && "bg-accent",
                      )}
                      aria-pressed={card?.cardId === c.cardId}
                      onClick={() => setCard(c)}
                    >
                      <strong className="tabular text-foreground">{c.label}</strong>
                      <span>{c.name}</span>
                      <span className="text-muted-foreground">· {c.setName}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {card && (
              <p role="status" className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
                선택: <strong className="tabular">{card.label}</strong> {card.name}
              </p>
            )}
          </div>

          {!artist && (
            <label className="block space-y-1.5">
              <span className={labelText}>작가 이름(닉네임)</span>
              <input name="artistName" required maxLength={80} className={input} />
            </label>
          )}

          <label className="block space-y-1.5">
            <span className={labelText}>도안 제목 (선택)</span>
            <span className={cn("block", hint)}>비워 두면 “{"{작가}"}님의 도안”으로 보여요.</span>
            <input name="title" maxLength={120} className={input} placeholder="예: 리자몽 9포켓 풀아트" />
          </label>

          <div className="space-y-2">
            <span className={labelText}>규격</span>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f: Format, i) => (
                <label
                  key={f}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-ink-700 transition-colors has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-accent-foreground"
                >
                  <input
                    type="radio"
                    name="format"
                    value={f}
                    required
                    defaultChecked={i === 0}
                    className="accent-primary"
                  />
                  {FORMAT_INFO[f].label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 우: 파일 */}
        <div className="space-y-5 rounded-2xl border border-border bg-background p-5">
          <FileField
            name="original"
            accept="image/png,image/jpeg,application/pdf"
            label="원본 파일 (필수)"
            hint="방문자가 받아 인쇄하는 파일이에요. PNG·JPEG·PDF, 100 MB까지"
          />
          <FileField
            name="thumbnail"
            accept="image/png,image/jpeg"
            label="미리보기 (선택)"
            hint="비워 두면 원본에서 자동으로 만들어요. PDF 원본이면 PNG·JPEG로 올려 주세요."
          />
          <label className={checkRow}>
            <input type="checkbox" name="printSizeVerified" className="accent-primary" />
            {artist ? "규격 인쇄 치수에 맞춰 만들었어요" : "파일 치수를 직접 확인함"} (방문자에게 인쇄 치수 안내)
          </label>
        </div>
      </div>

      {/* 어드민 전용: 출처 + 아티스트 허락 */}
      {!artist && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-border bg-background p-5">
            <span className={labelText}>출처 (선택)</span>
            <input name="sourceUrl" type="url" placeholder="https://cafe.naver.com/…" className={input} />
            <div className="flex flex-wrap gap-4">
              <label className={checkRow}>
                <input type="radio" name="sourceVisibility" value="public" defaultChecked className="accent-primary" />
                누구나 볼 수 있음
              </label>
              <label className={checkRow}>
                <input type="radio" name="sourceVisibility" value="members_only" className="accent-primary" />
                카페 회원 전용
              </label>
            </div>
          </div>
          <div className="space-y-3 rounded-2xl border border-border bg-background p-5">
            <span className={labelText}>아티스트 허락</span>
            <label className={checkRow}>
              <input type="checkbox" name="consent" required className="accent-primary" />
              보관·미리보기·다운로드를 허락받았어요
            </label>
            <label className="block space-y-1">
              <span className={hint}>허락 근거 (선택) — DM 캡처 등, 어드민만 볼 수 있어요</span>
              <input name="evidence" type="file" accept="image/png,image/jpeg,application/pdf" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink-700" />
            </label>
          </div>
        </div>
      )}

      <div role="status">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {saving && <p className="text-sm font-medium text-success">{saving}</p>}
      </div>
      <button
        type="submit"
        className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground transition-colors hover:bg-red-700 disabled:opacity-60"
        disabled={!!saving}
      >
        {artist ? "올리기" : "등록"}
      </button>
    </form>
  );
}
