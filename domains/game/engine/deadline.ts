// 게임오버 판정(순수). "어떤 공이 데드라인 위에 grace 이후로 gameOverMs 연속 머물면 끝".
// 물리/바디를 모르고 {id, topY, ageMs} 목록만 받으므로 결정론적으로 테스트된다.

export type DeadlineBall = {
  id: number;
  topY: number; // 공의 최상단 y (center.y - radius). 작을수록 위.
  ageMs: number; // 스폰 이후 경과(ms)
};

export class DeadlineWatcher {
  private over = new Map<number, number>();

  constructor(
    private readonly deadlineY: number,
    private readonly graceMs: number,
    private readonly gameOverMs: number,
  ) {}

  // 이번 스텝(dt) 반영 후 게임오버면 true.
  update(dt: number, balls: DeadlineBall[]): boolean {
    const seen = new Set<number>();
    let triggered = false;
    for (const b of balls) {
      seen.add(b.id);
      const aboveLine = b.ageMs > this.graceMs && b.topY < this.deadlineY;
      if (aboveLine) {
        const acc = (this.over.get(b.id) ?? 0) + dt;
        this.over.set(b.id, acc);
        if (acc >= this.gameOverMs) triggered = true;
      } else {
        this.over.set(b.id, 0);
      }
    }
    // 사라진 공(머지/제거)은 추적에서 제거.
    for (const id of [...this.over.keys()]) if (!seen.has(id)) this.over.delete(id);
    return triggered;
  }

  size(): number {
    return this.over.size;
  }
}
