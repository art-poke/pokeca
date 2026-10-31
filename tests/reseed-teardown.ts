import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

// 통합 테스트는 로컬 dev DB를 공유하며 데모 데이터를 지운다(truncate·유저 삭제).
// 테스트가 끝나면 데모를 다시 깔아, 로컬에서 바로 UI를 볼 수 있게 한다.
// .env.local이 없는 환경(CI 등)에서는 건너뛴다.
export function setup() {}

export async function teardown() {
  if (!existsSync(".env.local")) return;
  try {
    console.log("\n[reseed] 통합 테스트 후 데모 데이터 복구 중… (npm run demo)");
    execSync("npm run demo", { stdio: "inherit" });
  } catch (e) {
    console.warn("[reseed] 데모 복구 실패 — 수동으로 `npm run demo` 실행하세요:", (e as Error).message);
  }
}
