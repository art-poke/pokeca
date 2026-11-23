import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { DetailReport } from "@/components/admin/analytics/DetailReport";
import { topics, type Topic } from "@/components/admin/analytics/navigation";

type Props = PageProps<"/admin/insights/[topic]">;
async function Report({ params, searchParams }: Props) {
  await requireAdmin();
  const [{ topic }, q] = await Promise.all([params, searchParams]);
  if (!Object.hasOwn(topics, topic)) notFound();
  return <DetailReport topic={topic as Topic} q={q} />;
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={<p>지표를 불러오는 중…</p>}>
      <Report {...props} />
    </Suspense>
  );
}
