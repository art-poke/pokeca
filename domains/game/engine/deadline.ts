// 게임오버 판정(순수). 2단계:
//   ① 경고선(deadlineY) 위에 grace 이후로 gameOverMs 연속 머물면 끝(10초 유예).
//   ② 천장(ceilingY) 위에 settled 상태로 닿으면 즉시 끝.
// 물리/바디를 모르고 {id, topY, ageMs} 목록만 받으므로 결정론적으로 테스트된다.

export type DeadlineBall = {
  id: number;
  topY: number; // 공의 최상단 y (center.y - radius). 작을수록 위.
  ageMs: number; // 스폰 이후 경과(ms)
};

export class DeadlineWatcher {
  private over = new Map<number, number>();
  private maxDanger = 0;

  constructor(
    private readonly deadlineY: number,
    private readonly graceMs: number,
    private readonly gameOverMs: number,
    private readonly ceilingY: number = Number.NEGATIVE_INFINITY,
  ) {}

  // 이번 스텝(dt) 반영 후 게임오버면 true.
  update(dt: number, balls: DeadlineBall[]): boolean {
    const seen = new Set<number>();
    let triggered = false;
    let maxAcc = 0;
    for (const b of balls) {
      seen.add(b.id);
      const settled = b.ageMs > this.graceMs;
      // ② 천장 즉시 탈락.
      if (settled && b.topY < this.ceilingY) triggered = true;
      // ① 경고선 유예 누적.
      if (settled && b.topY < this.deadlineY) {
        const acc = (this.over.get(b.id) ?? 0) + dt;
        this.over.set(b.id, acc);
        if (acc >= this.gameOverMs) triggered = true;
        if (acc > maxAcc) maxAcc = acc;
      } else {
        this.over.set(b.id, 0);
      }
    }
    // 사라진 공(머지/제거)은 추적에서 제거.
    for (const id of [...this.over.keys()]) if (!seen.has(id)) this.over.delete(id);
    this.maxDanger = maxAcc;
    return triggered;
  }

  // 현재 경고선 위에서 가장 오래 버틴 누적 시간(ms). 카운트다운 표시용.
  dangerMs(): number {
    return this.maxDanger;
  }

  size(): number {
    return this.over.size;
  }
}
