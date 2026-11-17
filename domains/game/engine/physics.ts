// matter.js 월드 팩토리(헤드리스). 물리 계산만 담당하고 렌더러는 붙이지 않는다.
// 벽(좌/우/바닥)으로 유리 탱크를 만들고, 볼 추가/제거/스텝만 노출한다.
// 머지 충돌 감지는 game.ts가 engine에 Events 리스너를 달아 처리한다.

import Matter from "matter-js";
import {
  GRAVITY_Y,
  WALL_THICKNESS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  tierConfig,
} from "./ladder";

const { Engine, Bodies, Composite } = Matter;

// matter.js 바디에 우리 메타(tier, 고유 id)를 실어두는 plugin 모양.
export type BallPlugin = { tier: number; ballId: number };

export type Physics = {
  engine: Matter.Engine;
  addBall: (tier: number, x: number, y: number) => Matter.Body;
  removeBall: (body: Matter.Body) => void;
  step: (dtMs: number) => void;
  getBalls: () => Matter.Body[];
};

export const BALL_LABEL = "ball";

export const createPhysics = (): Physics => {
  const engine = Engine.create();
  engine.gravity.y = GRAVITY_Y;

  const t = WALL_THICKNESS;
  // 벽은 월드 밖으로 절반 걸치게 둬서 안쪽 플레이 영역이 0..WORLD_WIDTH / 0..WORLD_HEIGHT이 되도록.
  const left = Bodies.rectangle(-t / 2, WORLD_HEIGHT / 2, t, WORLD_HEIGHT * 3, { isStatic: true });
  const right = Bodies.rectangle(WORLD_WIDTH + t / 2, WORLD_HEIGHT / 2, t, WORLD_HEIGHT * 3, { isStatic: true });
  const floor = Bodies.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT + t / 2, WORLD_WIDTH * 3, t, { isStatic: true });
  Composite.add(engine.world, [left, right, floor]);

  let idSeq = 0;

  const addBall = (tier: number, x: number, y: number): Matter.Body => {
    const radius = tierConfig(tier).radius;
    const body = Bodies.circle(x, y, radius, {
      label: BALL_LABEL,
      restitution: 0.1,
      friction: 0.05,
      frictionStatic: 0.4,
      slop: 0.02,
      density: 0.001,
    });
    const plugin: BallPlugin = { tier, ballId: idSeq++ };
    body.plugin = plugin;
    Composite.add(engine.world, body);
    return body;
  };

  const removeBall = (body: Matter.Body): void => {
    Composite.remove(engine.world, body);
  };

  const step = (dtMs: number): void => {
    Engine.update(engine, dtMs);
  };

  const getBalls = (): Matter.Body[] =>
    Composite.allBodies(engine.world).filter((b) => !b.isStatic && b.label === BALL_LABEL);

  return { engine, addBall, removeBall, step, getBalls };
};
