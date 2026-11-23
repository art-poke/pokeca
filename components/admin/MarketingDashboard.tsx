import { requireAdmin } from "@/lib/admin";
import type { Filters } from "@/lib/analytics/report";
import { Overview } from "./analytics/Overview";

export async function MarketingDashboard({
  query,
}: {
  query: Promise<Filters>;
}) {
  await requireAdmin();
  return <Overview q={await query} />;
}
