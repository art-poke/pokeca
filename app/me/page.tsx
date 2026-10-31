import { Star } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProfileEdit } from "@/components/profile-edit";
import { RowsSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listFavoriteCards } from "@/lib/favorites";
import { anyMember, currentMember, type Member } from "@/lib/members";

export const metadata = { title: "마이프로필 · 확장 아트 아카이브" };

export default function MyProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-6 w-40" />
          <RowsSkeleton count={4} />
        </div>
      }
    >
      <Profile />
    </Suspense>
  );
}

// 로그인한 회원, 없으면 dev에서 데모 회원으로 미리보기, 그 외 로그인으로.
async function resolveMember(): Promise<{ member: Member; preview: boolean }> {
  const real = await currentMember();
  if (real) return { member: real, preview: false };
  if (process.env.NODE_ENV === "development") {
    const demo = await anyMember();
    if (demo) return { member: demo, preview: true };
  }
  redirect("/artist/login");
}

async function Profile() {
  const { member, preview } = await resolveMember();
  const favorites = await listFavoriteCards(member.userId);

  return (
    <div className="enter space-y-8">
      <ProfileEdit
        userId={member.userId}
        nickname={member.nickname}
        hasAvatar={!!member.avatarPath}
        preview={preview}
      />

      <section aria-labelledby="favs" className="space-y-4">
        <div className="flex items-center gap-2">
          <Star className="size-5 text-amber-400" aria-hidden />
          <h2 id="favs" className="font-display text-xl font-bold text-foreground">
            즐겨찾기한 카드 {favorites.length}개
          </h2>
        </div>

        {favorites.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
            아직 즐겨찾기한 카드가 없어요. 카드 페이지에서 <span className="font-semibold text-foreground">즐겨찾기</span>를 눌러 담아 보세요.
          </div>
        ) : (
          <ul className="enter grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((c) => (
              <li key={c.cardId}>
                <Link
                  href={c.path}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-background p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-gradient-to-br from-gray-50 to-gray-200 text-center">
                    <span className="tabular text-[11px] font-bold leading-tight text-ink-600">
                      {c.label.split(" ")[1] ?? c.label}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{c.name}</p>
                    <p className="tabular truncate text-xs text-muted-foreground">
                      {c.label} · {c.setName}
                    </p>
                    <div className="mt-1.5">
                      <Badge variant={c.artworkCount > 0 ? "soft" : "muted"}>
                        도안 {c.artworkCount}개
                      </Badge>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
