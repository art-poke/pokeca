import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

// 통합 테스트는 로컬 dev DB를 공유하며 데모 데이터를 지운다(truncate·유저 삭제).
// 테스트가 끝나면 데모를 다시 깔아, 로컬에서 바로 UI를 볼 수 있게 한다.
// .env.local이 없는 환경(CI 등)에서는 건너뛴다.
//
// ⚠️ 이 teardown은 절대 테스트 실행을 실패시키면 안 된다(종료 코드는 테스트 결과만 반영).
// 데모 시드 스크립트(scripts/*.mts)는 아직 Supabase를 가리키고 node 20에선 .mts 로딩이 깨진다 →
// 복구는 best-effort로만 돌리고, 어떤 오류든 삼켜 경고만 남긴다(데모 스크립트 전환은 서브 D로 이월).
export function setup() {}

export async function teardown() {
  try {
    if (!existsSync(".env.local")) return;
    console.log("\n[reseed] 통합 테스트 후 데모 데이터 복구 중… (npm run demo)");
    execSync("npm run demo", { stdio: "inherit" });
  } catch (e) {
    console.warn("[reseed] 데모 복구 건너뜀(비치명) — 필요하면 수동으로 `npm run demo`:", (e as Error).message);
  }
}
