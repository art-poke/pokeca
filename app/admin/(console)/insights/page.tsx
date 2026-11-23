import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { InsightIndex } from "@/components/admin/analytics/DetailReport";

async function Index({ searchParams }: PageProps<"/admin/insights">) {
  await requireAdmin();
  return <InsightIndex q={await searchParams} />;
}
export default function Page(props: PageProps<"/admin/insights">) {
  return (
    <Suspense fallback={<p>인사이트를 불러오는 중…</p>}>
      <Index {...props} />
    </Suspense>
  );
}
