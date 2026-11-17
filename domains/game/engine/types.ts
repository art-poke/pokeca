// 게임엔진 공용 타입. 렌더러는 이 스냅샷만 읽어 그린다(엔진 내부 접근 금지).

export type Rng = () => number; // 0..1

// 렌더러가 한 프레임을 그리기 위해 필요한 공 1개의 상태.
export type BallSnapshot = {
  id: number;
  tier: number;
  x: number;
  y: number;
  radius: number;
  angle: number;
};

// 렌더러로 내보내는 읽기전용 게임 스냅샷.
export type GameSnapshot = {
  score: number;
  nextTier: number; // 다음에 떨어질 볼 등급(크레인이 들고 있음)
  queue: number[]; // 그 뒤로 대기 중인 볼 등급들(공장 컨베이어)
  dropX: number; // 크레인 가로 위치(가상 월드 좌표)
  isGameOver: boolean;
  balls: BallSnapshot[];
};

// 머지가 일어났을 때 렌더러(이펙트)로 쏘는 이벤트.
export type MergeEvent = {
  x: number;
  y: number;
  tier: number; // 새로 생성된 등급(마스터 팝이면 사라진 등급)
  score: number; // 이번 머지로 가산된 점수
  isMaster: boolean; // 마스터볼끼리 터진 경우
};

// 게임 종료 시 서버 검증/제출용 통계.
export type GameStats = {
  ballsPlaced: number;
  maxTier: number;
  durationMs: number;
};
