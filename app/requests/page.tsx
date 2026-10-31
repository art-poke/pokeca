import { Megaphone } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { listOpenRequests } from "@/lib/art-requests";

export const metadata = { title: "도안 요청해요 · 확장 아트 아카이브" };

export default function RequestsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center gap-2">
        <Megaphone className="size-7 text-primary" aria-hidden />
        <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">도안 요청해요</h1>
      </header>
      <p className="text-sm text-muted-foreground">
        아직 도안이 없는 카드를 규격별로 요청하면 여기 모여요. 많이 요청된 순서로 위에 올라가요 —
        작가님들이 보고 그려줄 수 있게. 작가가 그 규격 도안을 올리면 자동으로 해결 처리돼요.
      </p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-gray-100" />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const items = await listOpenRequests();
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
        아직 요청된 도안이 없어요. 카드 페이지에서 ‘없는 규격 요청’을 눌러보세요.
      </div>
    );
  }
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
      {items.map((c, i) => (
        <li key={`${c.cardPath}-${c.format}`}>
          <Link
            href={c.cardPath}
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50"
          >
            <span className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="tabular font-semibold text-foreground">{c.cardLabel}</span>
                <Badge variant="secondary">{c.formatLabel}</Badge>
              </div>
              <div className="truncate text-sm text-muted-foreground">{c.name}</div>
            </div>
            <Badge variant="primary">요청 {c.count}</Badge>
          </Link>
        </li>
      ))}
    </ol>
  );
}
