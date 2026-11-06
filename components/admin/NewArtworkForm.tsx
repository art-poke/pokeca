"use client";

import { CreditCard, FileText, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useCreateArtworkMutation, useSearchCardsMutation } from "@/domains/admin/hooks";
import type { AdminCardHit as Card } from "@/domains/admin/api/types";
import { Badge } from "@/components/ui/badge";
import { cardImageUrl } from "@/lib/card-image";
import { FORMAT_INFO, FORMAT_PIECES, FORMATS, type Format } from "@/lib/formats";
import { cn } from "@/lib/utils";
import { errorMessage, uploadFile } from "./upload";

// 작품 등록: (좌) 카드·제목·규격 · (우) 파일 업로드+미리보기.
// mode "artist"는 승인 작가가 자기 도안을 올리는 화면(작가 이름=계정, 출처·허락 단계 없음, 바로 공개).
// 9포켓은 (1) 낱개 8칸을 원하는 자리에 배치하거나 (2) 8칸이 모인 조립본 한 장으로 올릴 수 있다.

type Piece = { file: File; url: string | null };
type NineMode = "pieces" | "single";

const input =
  "h-11 w-full rounded-lg border border-input bg-background px-3.5 text-base text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";
const labelText = "text-sm font-semibold text-foreground";
const hint = "text-xs text-muted-foreground";
const checkRow = "flex items-center gap-2 text-sm text-ink-700";

function makePiece(f: File): Piece {
  return { file: f, url: f.type === "application/pdf" ? null : URL.createObjectURL(f) };
}

// 규격·모드에 맞는 빈 슬롯. 9포켓 낱개는 8칸 고정(빈칸 포함), 그 외는 빈 배열(뒤로 추가).
function freshSlots(format: Format, nineMode: NineMode): (Piece | null)[] {
  return format === "9pocket" && nineMode === "pieces" ? Array(8).fill(null) : [];
}

// 원본 업로드 + 미리보기. binder=true면 9포켓 바인더처럼 3×3(가운데=실제 카드 자리),
// 둘레 8칸에 원하는 자리로 직접 올린다. 그 외는 뒤로 쌓는 격자.
function MultiImageField({
  slots,
  setSlots,
  max,
  accept,
  label,
  hint: hintText,
  binder = false,
}: {
  slots: (Piece | null)[];
  setSlots: React.Dispatch<React.SetStateAction<(Piece | null)[]>>;
  max: number;
  accept: string;
  label: string;
  hint: string;
  binder?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const target = useRef(0); // 바인더: 클릭한 칸(이 자리부터 채운다)

  // FileList는 input.files를 가리키는 라이브 참조라, value=""로 지우면 비게 된다.
  // 따라서 setState 업데이터(지연 실행) 전에 파일을 미리 조각으로 스냅샷한다.
  // 바인더: startSlot부터 빈 칸을 찾아 채운다(그 자리에 정확히, 여러 장이면 뒤 빈칸으로 이어짐).
  function placeFrom(startSlot: number, list: FileList | null) {
    if (!list?.length) return;
    const incoming = Array.from(list).map(makePiece);
    if (ref.current) ref.current.value = "";
    setSlots((prev) => {
      const next = [...prev];
      let slot = startSlot;
      for (const pc of incoming) {
        while (slot < next.length && next[slot]) slot++;
        if (slot >= next.length) break;
        next[slot] = pc;
        slot++;
      }
      return next;
    });
  }

  // 격자(비-바인더): 뒤로 추가한다(최대치까지).
  function append(list: FileList | null) {
    if (!list?.length) return;
    const incoming = Array.from(list).map(makePiece);
    if (ref.current) ref.current.value = "";
    setSlots((prev) => {
      const room = max - prev.length;
      if (room <= 0) return prev;
      return [...prev, ...incoming.slice(0, room)];
    });
  }

  // shift=true면 당겨서 지우고(격자), false면 그 자리만 비운다(바인더 빈칸 유지).
  function clearAt(i: number, shift: boolean) {
    setSlots((prev) => {
      const p = prev[i];
      if (p?.url) URL.revokeObjectURL(p.url);
      if (shift) return prev.filter((_, j) => j !== i);
      const next = [...prev];
      next[i] = null;
      return next;
    });
  }

  function pieceTile(p: Piece, i: number, showNumber: boolean) {
    return (
      <div
        key={`${p.file.name}-${i}`}
        className="relative aspect-[63/88] overflow-hidden rounded-lg border border-border bg-gray-50"
      >
        {p.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.url} alt={`조각 ${i + 1}`} className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
            <FileText className="size-6 text-ink-400" aria-hidden />
            <span className="line-clamp-2 text-[11px] text-ink-600">{p.file.name}</span>
          </div>
        )}
        {showNumber && (
          <span className="absolute left-1 top-1 rounded bg-ink-900/70 px-1.5 text-[11px] font-semibold text-white">
            {i + 1}
          </span>
        )}
        <button
          type="button"
          onClick={() => clearAt(i, !binder)}
          className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-background/90 text-ink-600 shadow-sm hover:text-destructive"
          aria-label={`${i + 1}번 조각 지우기`}
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  const filled = slots.filter(Boolean).length;
  const header = (
    <>
      <div className="flex items-center justify-between">
        <span className={labelText}>{label}</span>
        {max > 1 && <span className={hint}>{filled}/{max}장</span>}
      </div>
      <span className={cn("block", hint)}>{hintText}</span>
    </>
  );

  if (binder) {
    return (
      <div className="space-y-1.5">
        {header}
        <input
          ref={ref}
          type="file"
          accept={accept}
          multiple
          className="sr-only"
          onChange={(e) => placeFrom(target.current, e.target.files)}
        />
        <div className="mx-auto grid max-w-sm grid-cols-3 gap-2">
          {Array.from({ length: 9 }, (_, cell) => {
            if (cell === 4) {
              return (
                <div
                  key="center"
                  className="flex aspect-[63/88] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/40 p-1 text-center text-[11px] font-medium leading-tight text-muted-foreground"
                >
                  <CreditCard className="size-5" aria-hidden />
                  실제 카드 자리
                </div>
              );
            }
            const pi = cell < 4 ? cell : cell - 1;
            const p = slots[pi];
            if (p) return pieceTile(p, pi, true);
            return (
              <button
                key={`slot-${pi}`}
                type="button"
                onClick={() => {
                  target.current = pi;
                  ref.current?.click();
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  placeFrom(pi, e.dataTransfer.files);
                }}
                className="flex aspect-[63/88] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-gray-50 text-center transition-colors hover:border-primary hover:bg-primary/5"
                aria-label={`${pi + 1}번 자리에 올리기`}
              >
                <span className="text-lg font-semibold text-ink-300">{pi + 1}</span>
                <span className="flex items-center gap-0.5 text-[10px] font-medium text-ink-400">
                  <UploadCloud className="size-3" aria-hidden /> 올리기
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const full = slots.length >= max;
  return (
    <div className="space-y-1.5">
      {header}
      <div className={cn("grid gap-2", max > 1 ? "grid-cols-3" : "grid-cols-1")}>
        {slots.map((p, i) => (p ? pieceTile(p, i, max > 1) : null))}
        {!full && (
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              append(e.dataTransfer.files);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border bg-gray-50 text-center transition-colors hover:border-primary",
              max > 1 ? "aspect-[63/88]" : "min-h-48 p-4",
            )}
          >
            <input
              ref={ref}
              type="file"
              accept={accept}
              multiple={max > 1}
              className="sr-only"
              onChange={(e) => append(e.target.files)}
            />
            <UploadCloud className="size-6 text-ink-400" aria-hidden />
            <span className="px-2 text-xs font-medium text-ink-600">
              {slots.length === 0 ? "클릭·드래그로 올리기" : "더 추가"}
            </span>
          </label>
        )}
      </div>
    </div>
  );
}

// 단일 파일 드롭존(미리보기용). 슬랩류·PDF 원본일 때만 쓴다.
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
          // eslint-disable-next-line @next/next/no-img-element
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
  const { mutateAsync: searchCardsReq } = useSearchCardsMutation(api);
  const { mutateAsync: createArtwork } = useCreateArtworkMutation(api);
  const [id] = useState(() => crypto.randomUUID());
  const [cards, setCards] = useState<Card[] | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [format, setFormat] = useState<Format>(FORMATS[0]);
  const [nineMode, setNineMode] = useState<NineMode>("pieces");
  const [slots, setSlots] = useState<(Piece | null)[]>(() => freshSlots(FORMATS[0], "pieces"));
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 업로드 ID 캐시(파일 단위). 재시도해도 같은 파일은 다시 올리지 않는다.
  const uploaded = useRef(new Map<File, string>());

  // 9포켓 "낱개 8칸"은 바인더 3×3, "조립본 한 장"·슬랩류·그 외는 단일/격자.
  const binder = format === "9pocket" && nineMode === "pieces";
  const maxPieces = binder ? 8 : format === "9pocket" ? 1 : FORMAT_PIECES[format];
  const single = maxPieces === 1;

  function resetSlots(nextFormat: Format, nextNineMode: NineMode) {
    setSlots((prev) => {
      prev.forEach((p) => p?.url && URL.revokeObjectURL(p.url));
      return freshSlots(nextFormat, nextNineMode);
    });
  }

  function chooseFormat(f: Format) {
    setFormat(f);
    resetSlots(f, nineMode);
  }

  function chooseNineMode(m: NineMode) {
    setNineMode(m);
    resetSlots(format, m);
  }

  async function findCards(q: string) {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const hits = await searchCardsReq(q).catch(() => [] as Card[]);
      setCards(hits);
      if (hits.length === 1) setCard(hits[0]);
    } finally {
      setSearching(false);
    }
  }

  async function upload(kind: "original" | "thumbnail" | "evidence", file: File | null) {
    if (!file || file.size === 0) return undefined;
    const hit = uploaded.current.get(file);
    if (hit) return hit;
    setSaving(
      { original: "원본 올리는 중…", thumbnail: "미리보기 올리는 중…", evidence: "허락 근거 올리는 중…" }[kind],
    );
    const uploadId = await uploadFile(kind, file, api);
    uploaded.current.set(file, uploadId);
    return uploadId;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    if (!card) return setError("카드를 먼저 골라 주세요.");
    // 자리 정보를 유지한 채 채워진 조각만 추린다(바인더는 빈칸 건너뜀).
    const placed = slots
      .map((p, i) => (p ? { file: p.file, position: i } : null))
      .filter((x): x is { file: File; position: number } => x !== null);
    if (placed.length === 0) {
      return setError(binder ? "조각을 한 칸 이상 올려 주세요." : "원본 파일을 올려 주세요.");
    }
    const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
    if (!artist && form.get("consent") !== "on") {
      return setError("작가에게 사이트 보관·다운로드 허락을 받았는지 확인해 주세요.");
    }

    try {
      const originals: { uploadId: string; position: number }[] = [];
      for (const p of placed) {
        const uid = await upload("original", p.file);
        if (uid) originals.push({ uploadId: uid, position: p.position });
      }
      if (originals.length === 0) throw new Error("original_required");
      const thumbnail = single ? await upload("thumbnail", form.get("thumbnail") as File | null) : undefined;
      const evidence = artist ? undefined : await upload("evidence", form.get("evidence") as File | null);
      setSaving("저장 중…");
      const body = await createArtwork({
        id,
        cardId: card.cardId,
        artistName: form.get("artistName"),
        title: form.get("title"),
        format,
        sourceUrl: sourceUrl || null,
        sourceVisibility: sourceUrl ? form.get("sourceVisibility") : null,
        printSizeVerified: form.get("printSizeVerified") === "on",
        uploads: { originals, thumbnail, evidence },
      });
      router.push(artist ? "/artist?uploaded=1" : `/admin/artworks/${body.id}`);
    } catch (e) {
      setError(errorMessage(e instanceof Error ? e.message : ""));
      setSaving(null);
    }
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* 좌: 카드·제목·규격 — 우측 높이에 늘어나지 않고 자기 컨텐츠 높이만 갖는다. */}
        <div className="space-y-5 self-start rounded-2xl border border-border bg-background p-5">
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
              <ul className="max-h-64 divide-y divide-border overflow-auto rounded-xl border border-border" aria-label="카드 후보">
                {cards.map((c) => (
                  <li key={c.cardId}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-gray-50",
                        card?.cardId === c.cardId && "bg-accent",
                      )}
                      aria-pressed={card?.cardId === c.cardId}
                      onClick={() => setCard(c)}
                    >
                      {/* 아주 작은 카드 일러 */}
                      <div className="aspect-[63/88] w-9 shrink-0 overflow-hidden rounded border border-border bg-gray-100">
                        {c.imagePath && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cardImageUrl(c.imagePath, c.lang)}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <strong className="tabular shrink-0 text-sm text-foreground">{c.label}</strong>
                          {c.rarity && <Badge variant="outline">{c.rarity}</Badge>}
                        </div>
                        <div className="truncate text-sm text-foreground">{c.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{c.setName}</div>
                      </div>
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
              {FORMATS.map((f: Format) => (
                <label
                  key={f}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-ink-700 transition-colors has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-accent-foreground"
                >
                  <input
                    type="radio"
                    name="format"
                    value={f}
                    checked={format === f}
                    onChange={() => chooseFormat(f)}
                    className="accent-primary"
                  />
                  {FORMAT_INFO[f].label}
                </label>
              ))}
            </div>
            {FORMAT_INFO[format].printSize && <p className={hint}>인쇄: {FORMAT_INFO[format].printSize}</p>}
          </div>
        </div>

        {/* 우: 파일 */}
        <div className="space-y-5 rounded-2xl border border-border bg-background p-5">
          {/* 9포켓: 낱개 8칸 vs 조립본 한 장 — 라벨/토글을 양끝으로 */}
          {format === "9pocket" && (
            <div className="flex items-center justify-between gap-3">
              <span className={labelText}>올리는 방식</span>
              <div className="inline-flex rounded-xl bg-muted p-1">
                {(
                  [
                    { key: "pieces", label: "낱개 8칸" },
                    { key: "single", label: "조립본 한 장" },
                  ] as { key: NineMode; label: string }[]
                ).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    aria-pressed={nineMode === m.key}
                    onClick={() => chooseNineMode(m.key)}
                    className={cn(
                      "rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
                      nineMode === m.key
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <MultiImageField
            slots={slots}
            setSlots={setSlots}
            max={maxPieces}
            binder={binder}
            accept={single ? "image/png,image/jpeg,application/pdf" : "image/png,image/jpeg"}
            label={
              binder
                ? "원본 조각 (칸을 눌러 자리 지정)"
                : format === "9pocket"
                  ? "조립본 한 장 (필수)"
                  : single
                    ? "원본 파일 (필수)"
                    : `원본 조각 (필수 · 최대 ${maxPieces}장)`
            }
            hint={
              binder
                ? "가운데는 실제 카드 자리예요. 원하는 칸을 눌러 그 자리에 올리세요. 다운로드는 ZIP."
                : format === "9pocket"
                  ? "8칸이 한 장에 모인 파일이에요. 방문자가 받아서 잘라 써요. PNG·JPEG·PDF, 100 MB까지"
                  : single
                    ? "방문자가 받아 인쇄하는 파일이에요. PNG·JPEG·PDF, 100 MB까지"
                    : `여러 장이면 ZIP으로 묶여요. 최대 ${maxPieces}장, PNG·JPEG.`
            }
          />
          {single && (
            <FileField
              name="thumbnail"
              accept="image/png,image/jpeg"
              label="미리보기 (선택)"
              hint="비워 두면 원본에서 자동으로 만들어요. PDF 원본이면 PNG·JPEG로 올려 주세요."
            />
          )}
          {!artist && (
            <label className={checkRow}>
              <input type="checkbox" name="printSizeVerified" className="accent-primary" />
              파일 치수를 직접 확인함 (방문자에게 인쇄 치수 안내)
            </label>
          )}
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
