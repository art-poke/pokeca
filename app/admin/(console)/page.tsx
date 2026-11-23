import { Suspense } from "react";
import { MarketingDashboard } from "@/components/admin/MarketingDashboard";

export default function Page(props: PageProps<"/admin">) {
  return <Suspense fallback={<p>지표를 불러오는 중…</p>}><MarketingDashboard query={props.searchParams} /></Suspense>;
}
