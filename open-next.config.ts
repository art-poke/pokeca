import type { OpenNextConfig } from "@opennextjs/aws/types/open-next";

// art-poke는 cacheComponents off = 거의 전동적 렌더. ISR/revalidate 미사용 →
// 캐시 3종을 dummy로 꺼서 cache S3·revalidation Lambda·DynamoDB(tag) 인프라를 생략한다.
// (ISR/revalidatePath/revalidateTag를 쓰는 코드가 생기면 이 설정을 재검토할 것.)
const config: OpenNextConfig = {
  default: {
    override: {
      incrementalCache: "dummy",
      queue: "dummy",
      tagCache: "dummy",
    },
    // 앱이 lib/preview.ts에서 sharp를 직접 쓴다(썸네일 생성). OpenNext가 sharp를 external 처리하므로
    // server fn 번들에 Lambda(x86_64/linux/glibc)용 sharp를 명시 설치해야 한다(안 하면 모듈 로드 실패).
    install: {
      packages: ["sharp@0.35.5"],
      arch: "x64",
      os: "linux",
      libc: "glibc",
    },
  },
};

export default config;
