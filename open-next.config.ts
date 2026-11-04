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
  },
};

export default config;
