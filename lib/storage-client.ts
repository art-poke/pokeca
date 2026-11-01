import "server-only";
import { createClient } from "@supabase/supabase-js";

// 서브 D(S3 전환)까지 임시. 기존 db().storage.* 를 대체하는 얇은 스토리지 클라이언트.
let c: ReturnType<typeof createClient> | undefined;
export const storageClient = () => {
  if (!c)
    c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  return c.storage;
};
