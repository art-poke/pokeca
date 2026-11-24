import { describe, expect, it } from "vitest";
import { cropFrame, nameCropCenters, nameOpeningLevel, NAME_CROP_ZOOM, NAME_OPENING_ZOOM, oddCrop, oddVariant, ODD_VARIANT_COUNT, runtimeCrop } from "./crop";
import { applyGuess, applyRoundCommand, currentFrame, formatPlayTime, initialProgress, initialTimedProgress, koreaDay, longestStreak, moveMonth, rankingMonth } from "./rules";

const answer = { name: "리오르", aliases: ["Riolu"], slot: 2 };

describe("오늘의 카드조각", () => {
  it("한 판에서 힌트는 두 번까지 쓰고 같은 문제에 다시 요청해도 상태가 바뀌지 않는다", () => {
    const at = new Date(1_800_000_000_000);
    const started = applyRoundCommand(initialTimedProgress, "start", answer, at);
    const hint = { kind: "hint" } as const;
    const used = applyRoundCommand(started, hint, answer, at, 1);
    expect(used.used_hint).toBe(true);
    expect(applyRoundCommand(used, hint, answer, at, 2)).toBe(used);
    expect(applyRoundCommand(started, hint, answer, at, 2)).toBe(started);
    expect(applyRoundCommand(started, { kind: "name", value: "리오르" }, answer, at, 2).solved).toBe(true);
  });

  it("이름 맞히기의 첫 여섯 문제는 더 넓은 일러스트를 보여준다", () => {
    expect([1, 3, 4, 6, 7, 20].map(nameOpeningLevel)).toEqual([0, 0, 1, 1, null, null]);
    const area = { left: .1, top: .15, right: .9, bottom: .7 };
    const center = { x: .65, y: .4 };
    const width = (zoom: number) => cropFrame(600, 840, area, center, zoom).width;
    expect(width(NAME_OPENING_ZOOM[0].wide)).toBe(480);
    expect(width(NAME_OPENING_ZOOM[0].close)).toBeGreaterThan(width(NAME_OPENING_ZOOM[1].close));
    expect(width(NAME_OPENING_ZOOM[1].close)).toBeGreaterThan(width(NAME_CROP_ZOOM.close));
  });

  it("찾기 카드 조각의 원본 위치와 비율이 실제 픽셀과 일치한다", () => {
    const { crop, placement } = oddCrop(600, 840, { left: .1, top: .15, right: .9, bottom: .7 }, { x: .65, y: .4 }, 1240, 4);
    expect(placement.aspectRatio).toBeCloseTo(600 / 840);
    expect(placement.left * 600).toBeCloseTo(crop.left);
    expect(placement.top * 840).toBeCloseTo(crop.top);
    expect((1 - placement.left - placement.right) * 600).toBeCloseTo(crop.width);
    expect((1 - placement.top - placement.bottom) * 840).toBeCloseTo(crop.height);
    expect(crop.width).toBe(120);
    expect(crop.left).toBeGreaterThan(60);
  });

  it("찾기 게임에서 연속 정답이 늘어날수록 조각의 두 변이 줄어든다", () => {
    expect([1, 2, 3, 5, 6, 9, 10, 14, 15, 99].map(oddVariant)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
    const frames = Array.from({ length: ODD_VARIANT_COUNT }, (_, variant) =>
      oddCrop(600, 840, { left: .1, top: .15, right: .9, bottom: .7 }, { x: .65, y: .4 }, 1240, variant).crop);
    expect(frames[0].width).toBeGreaterThan(390);
    for (let index = 1; index < frames.length; index++) {
      expect(frames[index].width).toBeLessThan(frames[index - 1].width);
      expect(frames[index].height).toBeLessThan(frames[index - 1].height);
    }
  });

  it("이름 맞히기도 첫 오답에 끝나고 완료한 문제를 다시 채점하지 않는다", () => {
    const wrong = applyGuess(initialProgress, { kind: "name", value: "이브이" }, answer);
    expect(wrong).toMatchObject({ guesses: 1, solved: false });
    expect(currentFrame(wrong)).toBe("reveal");
    expect(applyGuess(wrong, { kind: "name", value: "리오르" }, answer)).toEqual(wrong);
  });

  it("힌트는 시도를 소비하지 않고 한글 입력과 별칭을 정규화한다", () => {
    const hinted = applyGuess(initialProgress, { kind: "hint" }, answer);
    expect(hinted).toMatchObject({ guesses: 0, used_hint: true });
    expect(currentFrame(hinted)).toBe("wide");
    expect(applyGuess(hinted, { kind: "name", value: "리 오 르" }, answer)).toMatchObject({ guesses: 1, solved: true });
    expect(applyGuess(initialProgress, { kind: "name", value: " Ｒｉｏｌｕ " }, answer).solved).toBe(true);
  });

  it("다른 포켓몬 찾기는 첫 선택으로 완료하고 다시 채점하지 않는다", () => {
    const result = applyGuess(initialProgress, { kind: "odd", value: 1 }, answer);
    expect(result).toMatchObject({ choice: 1, guesses: 1, solved: false });
    expect(applyGuess(result, { kind: "odd", value: 2 }, answer)).toBe(result);
  });

  it("포켓몬 이름의 일반·전각·줄바꿈 공백을 무시한다", () => {
    const card = { name: "이상해풀", aliases: [], slot: 0 };
    for (const name of ["이상해풀", "이상해 풀", " 이상해\u3000풀 ", "이상해\n풀"]) {
      expect(applyGuess(initialProgress, { kind: "name", value: name }, card).solved).toBe(true);
    }
  });

  it("게임 진행 시간을 읽기 쉬운 경과 시간으로 표시한다", () => {
    expect(formatPlayTime(0)).toBe("00:00");
    expect(formatPlayTime(61_999)).toBe("01:01");
    expect(formatPlayTime(3_661_000)).toBe("1:01:01");
  });

  it("시작과 힌트 재요청으로 제한 시간이 늘어나지 않고 20초 뒤에는 정답도 시간 초과로 처리한다", () => {
    const at = (ms: number) => new Date(1_800_000_000_000 + ms);
    const started = applyRoundCommand(initialTimedProgress, "start", answer, at(0));
    expect(applyRoundCommand(started, "start", answer, at(5000))).toBe(started);
    expect(applyRoundCommand(started, "timeout", answer, at(19_999))).toBe(started);
    const hint = applyRoundCommand(started, { kind: "hint" }, answer, at(10_000));
    expect(hint).toMatchObject({ started_at: started.started_at, used_hint: true });
    const correct = { kind: "name", value: "리오르" } as const;
    expect(applyRoundCommand(hint, correct, answer, at(19_999)).solved).toBe(true);
    expect(applyRoundCommand(hint, correct, answer, at(20_000))).toMatchObject({ solved: false, timed_out: true });
  });

  it("한국 시간 자정과 연속 날짜를 기준으로 기록을 계산한다", () => {
    expect(koreaDay(new Date("2026-11-21T14:59:59.999Z"))).toBe("2026-11-21");
    expect(koreaDay(new Date("2026-11-21T15:00:00.000Z"))).toBe("2026-11-22");
    expect(longestStreak(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-03"])).toBe(3);
  });

  it("하프 일러스트 가장자리에서 3배와 2배 조각을 그림 안에 유지한다", () => {
    const area = { left: 0.1, top: 0.1, right: 0.9, bottom: 0.5 };
    const center = { x: 0.89, y: 0.49 };
    expect(cropFrame(900, 1200, area, center, 3)).toEqual({ left: 570, top: 440, width: 240, height: 160 });
    expect(cropFrame(900, 1200, area, center, 2)).toEqual({ left: 450, top: 360, width: 360, height: 240 });
  });

  it("이름 문제에서 네 방향의 조각을 만들고 가장자리에서 겹치는 위치를 제외한다", () => {
    const area = { left: 0.1, top: 0.1, right: 0.9, bottom: 0.5 };
    const centers = nameCropCenters(900, 1200, area, { x: 0.5, y: 0.3 });
    expect(centers).toHaveLength(4);
    const frames = centers.map((center) => cropFrame(900, 1200, area, center, 3));
    expect(new Set(frames.map((frame) => frame.left)).size).toBe(2);
    expect(new Set(frames.map((frame) => frame.top)).size).toBe(2);
    const edge = nameCropCenters(900, 1200, area, { x: area.left, y: area.top });
    expect(edge).toHaveLength(1);
    for (const center of [...centers, ...edge]) {
      const wide = cropFrame(900, 1200, area, center, 2);
      expect(wide.left).toBeGreaterThanOrEqual(90);
      expect(wide.top + wide.height).toBeLessThanOrEqual(600);
    }
  });

  it("이름 문제에서 배경 단서는 여유 있게 자르고 카드 제목 영역을 피한다", () => {
    const game = "name";
    const source = { id: "fixture", width: 600, height: 840, area: { left: .1, top: .15, right: .9, bottom: .65 }, focus: { x: .5, y: .4 } };
    const variants = Array.from({ length: 80 }, (_, seed) => {
      const runId = `test-run-${seed}`;
      const { crop, placement } = runtimeCrop(source, game, 15, runId, 0, "close");
      expect(crop.left).toBeGreaterThanOrEqual(60);
      expect(crop.top).toBeGreaterThanOrEqual(126);
      expect(crop.left + crop.width).toBeLessThanOrEqual(540);
      expect(crop.top + crop.height).toBeLessThanOrEqual(546);
      expect(placement.left * 600).toBeCloseTo(crop.left);
      expect(placement.top * 840).toBeCloseTo(crop.top);
      expect(runtimeCrop(source, game, 15, runId, 0, "close").crop).toEqual(crop);
      return crop;
    });
    const wide = variants.filter((crop) => crop.width >= 320 && crop.height >= 280);
    expect(wide.length).toBeGreaterThan(10);
    expect(new Set(wide.map((crop) => `${crop.left}/${crop.top}`)).size).toBe(4);
    expect(variants.some((crop) => crop.width < 200)).toBe(true);
  });

  it("다른 포켓몬 찾기는 얼굴 위치와 관계없이 같은 창을 쓰고 매 라운드 조각을 조금씩 줄인다", () => {
    const source = { id: "fixture", width: 600, height: 840, area: { left: .1, top: .15, right: .9, bottom: .65 }, focus: { x: .5, y: .4 } };
    const take = (round: number, run = "fixture") => runtimeCrop(source, "odd", round, run, 0, "close").crop;
    for (let round = 2; round <= 18; round++) {
      expect(take(round).width).toBeLessThan(take(round - 1).width);
      expect(take(round).height).toBeLessThan(take(round - 1).height);
    }
    expect(take(30)).toEqual(expect.objectContaining({ width: take(18).width, height: take(18).height }));
    expect(runtimeCrop({ ...source, focus: { x: .2, y: .3 } }, "odd", 4, "fixture", 2, "close").crop).toEqual(take(4));
    const samples = Array.from({ length: 64 }, (_, i) => take(10, `sample-${i}`));
    expect(Math.min(...samples.map((crop) => crop.top))).toBeLessThan(165);
    expect(Math.max(...samples.map((crop) => crop.top))).toBeGreaterThan(255);
  });

  it("랭킹에서 지난달을 볼 수 있고 미래나 잘못된 월은 이번 달로 돌아간다", () => {
    expect(moveMonth("2026-01", -1)).toBe("2025-12");
    expect(rankingMonth("2026-03", "2026-11-21")).toBe("2026-03");
    expect(rankingMonth("2026-12", "2026-11-21")).toBe("2026-11");
    expect(rankingMonth("2025-14", "2026-11-21")).toBe("2026-11");
  });
});
