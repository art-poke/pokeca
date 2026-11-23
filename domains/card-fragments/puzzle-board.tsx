"use client";

import { useEffect, useEffectEvent, useRef, useState, useTransition, type CSSProperties, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { signal } from "@/lib/analytics/tracker";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Circle, CircleCheck, CircleX, Play, RotateCcw, Timer, Volume2, VolumeX, X } from "lucide-react";
import { AppImage } from "@/components/ui/app-image";
import { cn } from "@/lib/utils";
import { beginCardFragmentRun, playCardFragmentRun } from "./actions";
import guessName from "@/public/games/guess-name.webp";
import findTheCard from "@/public/games/find-the-card.webp";
import type { CardPlacement } from "./crop";
import { currentFrame, formatPlayTime, ROUND_LIMIT_MS, type Game, type Progress } from "./rules";
import type { PuzzleView } from "./round-view";
import styles from "./puzzle-board.module.css";

const button = "inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50";
const options = ["A", "B", "C"];

const ADVANCE_MS = 3_000;
const START_MS = 3_450;
const confetti = ["#ff5159", "#fbbf24", "#22c55e", "#60a5fa", "#a855f7", "#fb7185"];

function CardRevealFrame({ image, placement, game, alt, reveal, animate }: {
  image: string;
  placement?: CardPlacement;
  game: Game;
  alt: string;
  reveal?: { image: string; name: string };
  animate: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const inset = placement ? [placement.top, placement.right, placement.bottom, placement.left].map((edge) => `${edge * 100}%`).join(" ") : "25%";
  const style = { aspectRatio: placement?.aspectRatio ?? "5 / 7", "--fragment-inset": inset } as CSSProperties;
  return (
    <div data-testid={`${game}-card-frame`} className="relative isolate w-full overflow-hidden rounded-lg bg-muted ring-1 ring-inset ring-border sm:rounded-xl" style={style}>
      <div data-testid={`${game}-card-fragment`} className="absolute transition-[inset] duration-300 ease-out motion-reduce:transition-none" style={{ inset }}>
        <AppImage key={image} src={image} alt={reveal ? "" : alt} priority fit="contain" className="size-full bg-transparent" />
      </div>
      {reveal && (
        // The image stays clipped to the original fragment until the full card loads.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={reveal.image} alt={reveal.name} decoding="async" onLoad={() => setLoaded(true)}
          ref={(node) => { if (node?.complete && node.naturalWidth > 0) setLoaded(true); }}
          className={cn("absolute inset-0 size-full object-fill", styles.cardReveal,
            loaded && (animate ? styles.cardRevealPlaying : styles.cardRevealComplete))} />
      )}
    </div>
  );
}

function Celebration() {
  return (
    <span data-testid="card-fragment-celebration" aria-hidden="true" className={styles.celebration}>
      <span className={styles.burstRing} />
      {Array.from({ length: 22 }, (_, index) => {
        const angle = (index / 22) * Math.PI * 2;
        const distance = 48 + (index % 4) * 22;
        return <span key={index} className={styles.confetti} style={{
          "--burst-x": `${Math.cos(angle) * distance}px`,
          "--burst-y": `${Math.sin(angle) * distance}px`,
          "--burst-spin": `${index % 2 ? -240 : 280}deg`,
          backgroundColor: confetti[index % confetti.length],
        } as CSSProperties} />;
      })}
    </span>
  );
}

function playNotes(context: AudioContext, frequencies: number[]) {
  frequencies.forEach((frequency, index) => {
    const start = context.currentTime + index * 0.13;
    const tone = context.createOscillator();
    const volume = context.createGain();
    tone.frequency.value = frequency;
    volume.gain.setValueAtTime(0.001, start);
    volume.gain.exponentialRampToValueAtTime(0.11, start + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.001, start + 0.11);
    tone.connect(volume).connect(context.destination);
    tone.start(start);
    tone.stop(start + 0.12);
  });
}

function playShuffle(context: AudioContext, count: number) {
  const length = Math.floor(context.sampleRate * 0.07);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index++) {
    samples[index] = (Math.random() * 2 - 1) * 0.22 * (1 - index / length) ** 3;
  }
  for (let index = 0; index < count; index++) {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = count === 1 ? 1900 : 1050;
    source.buffer = buffer;
    source.connect(filter).connect(context.destination);
    source.start(context.currentTime + index * 0.13);
  }
}

export function PuzzleBoard({ game }: { game: Game }) {
  const router = useRouter();
  const [puzzle, setPuzzle] = useState<PuzzleView | null>(null);
  const [phase, setPhase] = useState<"ready" | "countdown" | "play">("ready");
  const [introAt, setIntroAt] = useState(0);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const nameLabel = "포켓몬 이름";
  const [answer, setAnswer] = useState("");
  const [sound, setSound] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const frame = puzzle ? currentFrame(puzzle.progress) : "close";
  const answerCard = puzzle?.reveal?.cards[puzzle.reveal.slot];
  const finished = puzzle?.progress.solved != null;
  const correct = puzzle?.progress.solved === true;
  const hasWrongGuess = (puzzle?.progress.guesses ?? 0) > 0 && !correct;
  const feedback = useRef<HTMLDivElement>(null);
  const followFeedback = useRef(false);
  const [nextAt, setNextAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [showMiss, setShowMiss] = useState(false);
  const remaining = nextAt === null ? null : Math.max(0, Math.ceil((nextAt - now) / 1_000));
  const deadline = puzzle?.deadline ?? null;
  const timeLeft = deadline === null ? ROUND_LIMIT_MS : Math.min(ROUND_LIMIT_MS, Math.max(0, deadline - now));
  const secondsLeft = Math.ceil(timeLeft / 1_000);
  const elapsed = Math.max(0, (endedAt ?? now) - introAt - START_MS);
  const introRemaining = Math.max(0, 3 - Math.floor((now - introAt) / 1_000));
  const showFeedback = finished || hasWrongGuess;

  useEffect(() => {
    if (!followFeedback.current || !showFeedback) return;
    feedback.current?.scrollIntoView({ block: "nearest" });
    followFeedback.current = false;
  }, [puzzle?.progress.guesses, puzzle?.progress.solved, showFeedback]);
  const advance = useEffectEvent(() => submit("next"));

  useEffect(() => {
    if (nextAt === null) return;
    const timer = window.setTimeout(advance, Math.max(0, nextAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [nextAt]);

  useEffect(() => {
    if (phase !== "countdown") return;
    const interval = window.setInterval(() => setNow(Date.now()), 50);
    const ready = window.setTimeout(() => setPhase("play"), Math.max(0, introAt + START_MS - Date.now()));
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(ready);
    };
  }, [introAt, phase]);

  useEffect(() => {
    if (phase !== "play") return;
    const tick = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(tick);
  }, [phase]);

  const startRound = useEffectEvent(() => submit("start"));
  const expireRound = useEffectEvent(() => submit("timeout"));

  useEffect(() => {
    if (phase !== "play" || finished || pending || error || deadline !== null || !puzzle) return;
    const task = window.setTimeout(startRound, 0);
    return () => window.clearTimeout(task);
  }, [phase, finished, pending, error, deadline, puzzle]);

  useEffect(() => {
    if (phase !== "play" || finished || deadline === null || timeLeft > 0 || pending || error) return;
    const task = window.setTimeout(expireRound, 0);
    return () => window.clearTimeout(task);
  }, [phase, finished, deadline, timeLeft, pending, error]);

  useEffect(() => () => {
    const context = audio.current;
    audio.current = null;
    if (context) void context.close().catch(() => {});
  }, []);

  function submit(kind: "start" | "timeout" | "hint" | "name" | "odd" | "next", value = "") {
    if (!puzzle || busy.current || (puzzle.reveal && kind !== "next")) return;
    busy.current = true;
    setError("");
    if (kind === "next") setNextAt(null);
    if (sound && audio.current) void audio.current.resume().catch(() => {});
    followFeedback.current = kind === "name" || kind === "odd" || kind === "timeout";
    const form = new FormData();
    form.set("kind", kind);
    form.set("value", value);

    startTransition(async () => {
      try {
        const result = await playCardFragmentRun(game, puzzle.runId, puzzle.stage, puzzle.progress.guesses, form);
        if (!result.puzzle) {
          setError(result.error ?? "다시 시도해 주세요.");
          return;
        }

        const next = result.puzzle;
        const round = [puzzle.day,puzzle.practiceId ?? "ranked",puzzle.stage].join("-");
        if (kind === "start" && puzzle.deadline === null) signal("game_started",{game,round});
        if (puzzle.progress.solved === null && next.progress.solved !== null) signal("game_finished",{game,round});
        const answeredAt = Date.now();
        if (kind === "next") {
          setCelebrate(false);
          setShowMiss(false);
        } else if (next.progress.solved === true) {
          setNow(answeredAt);
          setNextAt(answeredAt + ADVANCE_MS);
          setCelebrate(true);
        } else if (next.progress.solved === false) {
          followFeedback.current = true;
          setShowMiss(true);
          setEndedAt(answeredAt);
        }

        setPuzzle(next);
        if (next.progress.guesses !== puzzle.progress.guesses) setAnswer("");
        if ((kind !== "next" && kind !== "start") || next.progress.solved === false) playFeedback(next.progress);
        if (kind !== "next" && next.progress.solved !== null) router.refresh();
      } catch {
        setError("문제를 처리하는 중 문제가 생겼어요. 다시 시도해 주세요.");
      } finally {
        busy.current = false;
      }
    });
  }

  function playFeedback(progress: Progress) {
    if (!sound || !audio.current) return;
    if (progress.solved && game === "odd") playShuffle(audio.current, 3);
    else if (progress.solved) playNotes(audio.current, [530, 790]);
    else if (progress.solved === false) playNotes(audio.current, [360, 240]);
    else playShuffle(audio.current, 1);
  }

  function clearRoundControls() {
    followFeedback.current = false;
    setNextAt(null);
    setCelebrate(false);
    setShowMiss(false);
    setError("");
    setAnswer("");
  }

  function startNewRun() {
    if (busy.current) return;
    busy.current = true;
    setError("");
    startTransition(async () => {
      try {
        const result = await beginCardFragmentRun(game);
        if (!result.puzzle) {
          setError(result.error ?? "새 게임을 시작할 수 없어요.");
          return;
        }
        clearRoundControls();
        const startedAt = Date.now();
        setEndedAt(null);
        startCountdown(startedAt);
        setPuzzle(result.puzzle);
        feedback.current?.scrollIntoView({ block: "nearest" });
      } catch {
        setError("새 게임을 시작할 수 없어요. 다시 시도해 주세요.");
      } finally {
        busy.current = false;
      }
    });
  }

  function startCountdown(time: number) {
    setNow(time);
    setIntroAt(time);
    setPhase("countdown");
  }

  function toggleSound() {
    if (!sound) {
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume().catch(() => {});
      } catch {
        return;
      }
    }
    setSound(!sound);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (game === "name" && answer.trim()) {
      event.currentTarget.querySelector("input")?.blur();
      submit("name", answer);
    }
  }

  if (phase !== "play" || !puzzle) {
    const cover = game === "name" ? guessName.src : findTheCard.src;
    return (
      <section aria-label="게임 시작" className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="relative isolate">
          <AppImage src={cover} alt="" aspectRatio="2 / 1" fit="cover" priority />
          {phase === "countdown" && (
            <div role="status" className="absolute inset-0 grid place-items-center bg-black/60 text-white backdrop-blur-[2px]">
              <span key={introRemaining} className={cn("text-6xl font-black tracking-tight tabular-nums sm:text-7xl", styles.startBeat)}>
                {introRemaining || "시작!"}
              </span>
            </div>
          )}
        </div>
        <div className="p-4 sm:p-5">
          {phase === "ready" ? (
            <>
              <button type="button" disabled={pending} onClick={startNewRun}
                className={cn(button, "w-full gap-2")}>
                <Play aria-hidden className="size-4 fill-current" /> {pending ? "불러오는 중…" : "게임 시작하기"}
              </button>
              {error && <p role="alert" className="mt-3 text-sm text-primary">{error}</p>}
            </>
          ) : (
            <p className="flex min-h-12 items-center justify-center text-sm font-semibold text-muted-foreground">잠시 후 게임이 시작돼요</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex min-h-14 items-center justify-between gap-2 border-b border-border px-3 sm:px-4">
        <p className="text-sm font-semibold">
          <span className="inline-block rounded-full bg-foreground px-2.5 py-1 text-background">연속 정답 {puzzle.stage - 1 + (correct ? 1 : 0)}개</span>
        </p>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <p className="text-xs text-muted-foreground">
            진행 시간 <span role="timer" className="ml-0.5 font-bold tabular-nums text-foreground">{formatPlayTime(elapsed)}</span>
          </p>
          <button type="button" aria-label="효과음" aria-pressed={sound} onClick={toggleSound}
            className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-muted">
            {sound ? <Volume2 aria-hidden className="size-5" /> : <VolumeX aria-hidden className="size-5" />}
          </button>
        </div>
      </div>
      <div ref={feedback} className="scroll-mt-16" />
      <div aria-hidden={finished || undefined} className={cn("space-y-2 border-b border-border bg-muted/35 px-3 py-2.5 sm:px-5", finished && "invisible")}>
        <p className={cn("flex items-center justify-between gap-2 text-sm font-bold",
          secondsLeft <= 5 ? "text-red-700" : "text-foreground")}>
          <span className="inline-flex items-center gap-2"><Timer aria-hidden className="size-4" /> 제한 시간</span>
          <span aria-label="남은 제한 시간" className="tabular-nums">{secondsLeft}초</span>
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className={cn("h-full origin-left rounded-full transition-transform duration-200 ease-linear",
            secondsLeft <= 5 ? "bg-red-600" : "bg-emerald-500")}
            style={{ transform: `scaleX(${timeLeft / ROUND_LIMIT_MS})` }} />
        </div>
      </div>
      {game === "odd" && (puzzle.deadline !== null || puzzle.reveal) && (
        <div className="grid grid-cols-3 items-start gap-2 px-3 pb-2 pt-3 sm:gap-4 sm:px-5 sm:pt-5">
          {puzzle.fragments.map(({ image, placement }, index) => {
            const label = options[index];
            const revealedCard = puzzle.reveal?.cards[index];
            const isAnswer = puzzle.reveal?.slot === index;
            const isChoice = puzzle.progress.choice === index;
            return (
              <div key={image} className="relative min-w-0">
                <div className={cn("rounded-lg sm:rounded-xl", isAnswer && "ring-2 ring-emerald-600", isChoice && !isAnswer && "ring-2 ring-red-500")}>
                  <CardRevealFrame game="odd" image={image} placement={placement} alt={`카드 조각 ${label}`} reveal={revealedCard} animate={showFeedback} />
                </div>
                {revealedCard ? (
                  <Link href={revealedCard.href} className="flex min-h-11 items-center justify-center px-0.5 text-center text-xs font-semibold underline-offset-4 hover:underline sm:text-sm">
                    {label} · {revealedCard.name}
                  </Link>
                ) : (
                  <>
                    <span aria-hidden="true" className="grid min-h-11 place-items-center text-sm font-bold">{label}</span>
                    <button type="button" onClick={() => submit("odd", String(index))} disabled={pending || timeLeft === 0} aria-label={`카드 ${label}`}
                      className="absolute inset-0 rounded-lg transition-shadow hover:ring-2 hover:ring-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait sm:rounded-xl" />
                  </>
                )}
                {revealedCard && (revealedCard.shiny || revealedCard.cameo) && (
                  <p className="text-center text-xs text-muted-foreground">
                    {[revealedCard.shiny && "이로치", revealedCard.cameo && `카메오 · ${revealedCard.cameo}`].filter(Boolean).join(" / ")}
                  </p>
                )}
                {revealedCard && (isAnswer || isChoice) && (
                  <p className={cn("text-center text-xs font-medium", isAnswer ? "text-emerald-800" : "text-muted-foreground")}>
                    {isAnswer ? "정답 카드" : "내 선택"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {game === "name" && (puzzle.deadline !== null || puzzle.reveal) && (
        <div className="mx-auto w-full max-w-56 px-3 pt-3 sm:max-w-64 sm:pt-5">
          <CardRevealFrame key={`${puzzle.day}/${puzzle.stage}/${puzzle.runId}`}
            game="name" image={puzzle.fragments[0].image} placement={puzzle.fragments[0].placement}
            alt={`${nameLabel} 문제의 일러스트 조각`} reveal={answerCard} animate={showFeedback} />
          {answerCard && (
            <Link href={answerCard.href} className="flex min-h-11 items-center justify-center text-center text-xs font-semibold underline-offset-4 hover:underline sm:text-sm">
              카드 상세 보기
            </Link>
          )}
        </div>
      )}
      {puzzle.reveal ? (
        <div className="space-y-4 px-3 pb-4 pt-3 sm:space-y-5 sm:p-5">
          <div role="status" aria-live="polite" aria-atomic="true" className={cn("relative isolate rounded-2xl bg-muted/70 px-4 py-3.5 sm:px-5", showMiss && styles.missShake)}>
            {celebrate && correct && <Celebration />}
            {((celebrate && correct) || (showMiss && !correct)) && createPortal(
              <div data-testid={correct ? "card-fragment-hit" : "card-fragment-miss"} aria-hidden="true"
                className={cn(styles.resultOverlay, correct && styles.hitOverlay, styles.delayedResultOverlay)}
                onAnimationEnd={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (correct) setCelebrate(false);
                  else setShowMiss(false);
                }}>
                <div className={styles.resultIcon}>
                  {correct ? <Circle className="size-1/2 stroke-[3]" /> : <X className="size-1/2 stroke-[3]" />}
                </div>
              </div>,
              document.body,
            )}
            <div className="relative flex items-center gap-3">
              <div className={cn("grid size-9 shrink-0 place-items-center rounded-full",
                correct ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800")}>
                {correct ? <CircleCheck aria-hidden className="size-5" /> : <CircleX aria-hidden className="size-5" />}
              </div>
              <div className="min-w-0">
                <p className={cn("text-xs font-bold", correct ? "text-emerald-800" : "text-red-800")}>
                  {correct ? "정답이에요!" : puzzle.timedOut ? "시간 초과 · 게임 종료" : "오답이에요. 게임 종료"}
                  {game === "name" && correct && puzzle.progress.guesses === 1 && !puzzle.progress.used_hint && <span aria-label="별 획득"> ★</span>}
                </p>
                <p className="mt-0.5 text-xl font-black tracking-tight">
                  {game === "odd" && `${options[puzzle.reveal.slot]} · `}{answerCard?.name}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            {remaining !== null && correct && (
              <p className="text-center text-sm font-semibold text-muted-foreground">
                {remaining > 0 ? <><span className="tabular-nums text-foreground">{remaining}초</span> 뒤 다음 문제로 넘어가요.</> : "다음 문제로 이동 중…"}
              </p>
            )}
            {correct ? (
              <button type="button" disabled={pending} onClick={() => submit("next")} className={cn(button, "w-full gap-2")}>
                다음 문제 <ArrowRight aria-hidden className="size-4" />
              </button>
            ) : (
              <>
                <button type="button" onClick={startNewRun} disabled={pending} className={cn(button, "w-full gap-2")}>
                  <RotateCcw aria-hidden className="size-4" /> {pending ? "불러오는 중…" : "새 게임 시작"}
                </button>
                <p className="text-center text-xs text-muted-foreground">이번 게임 기록이 저장됐어요.</p>
              </>
            )}
          </div>
        </div>
      ) : puzzle.deadline === null ? (
        <div className="grid min-h-56 place-content-center gap-3 p-5 text-center text-sm font-semibold text-muted-foreground">
          {error ? (
            <button type="button" onClick={() => submit("start")} disabled={pending} className={button}>다시 불러오기</button>
          ) : "문제를 준비하고 있어요…"}
        </div>
      ) : game === "name" && (
        <form onSubmit={onSubmit} aria-busy={pending} className="p-3 sm:p-5">
          {showFeedback && !correct && <p role="status" className="mb-2 rounded-xl bg-red-50 p-3 text-sm text-red-900">이전 답은 오답이었어요. 다시 답을 입력해 주세요.</p>}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input aria-label={nameLabel} placeholder={`${nameLabel} 입력`} value={answer} onChange={(event) => setAnswer(event.target.value)}
              autoComplete="off" enterKeyHint="go" maxLength={40} disabled={pending || timeLeft === 0}
              onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }}
              className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-base" />
            <button className={button} disabled={pending || timeLeft === 0 || !answer.trim()}>제출</button>
            <div className="col-span-2 flex items-center justify-between gap-3">
              <button type="button" onClick={() => submit("hint")}
                disabled={pending || timeLeft === 0 || frame !== "close" || puzzle.hintsRemaining === 0}
                className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50">힌트 보기</button>
              <span role="status" className="text-sm font-medium tabular-nums text-muted-foreground">남은 힌트 {puzzle.hintsRemaining}회</span>
            </div>
          </div>
        </form>
      )}
      {error && !finished && puzzle.deadline !== null && timeLeft === 0 && (
        <button type="button" onClick={() => submit("timeout")} disabled={pending} className="mx-3 mb-2 min-h-11 rounded-xl border border-border px-4 text-sm font-semibold">
          결과 다시 불러오기
        </button>
      )}
      {error && <p role="alert" className="px-3 pb-3 text-sm text-primary sm:px-5">{error}</p>}
    </section>
  );
}
