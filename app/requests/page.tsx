import { Megaphone } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { RowsSkeleton } from "@/components/skeletons";
import { listOpenRequests } from "@/lib/art-requests";
import { RequestDetails } from "./request-details";

export const metadata = { title: "도안 요청해요 · Extended Art Archive" };

export default function RequestsPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <Megaphone className="size-7 text-primary" aria-hidden />
        <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">도안 요청해요</h1>
      </header>
      <p className="text-sm text-muted-foreground">
        아직 도안이 없는 카드를 규격별로 요청하면 여기 모여요. 많이 요청된 순서로 위에 올라가요 —
        작가님들이 보고 그려줄 수 있게. 요청을 누르면 누가 요청했는지 볼 수 있어요.
        작가가 그 규격 도안을 올리면 자동으로 해결 처리돼요.
      </p>
      <Suspense fallback={<RowsSkeleton />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  await connection();
  const items = await listOpenRequests();
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
        아직 요청된 도안이 없어요. 카드 페이지에서 ‘없는 규격 요청’을 눌러보세요.
      </div>
    );
  }
  return (
    <ol className="enter divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
      {items.map((c, i) => (
        <li key={`${c.cardPath}-${c.format}`}>
          <RequestDetails item={c} rank={i + 1} />
        </li>
      ))}
    </ol>
  );
}
