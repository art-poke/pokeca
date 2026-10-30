import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { currentAdmin } from "@/lib/admin";
import { currentArtist, currentSocialUser } from "@/lib/artists";
import { UserMenu } from "./user-menu";

// 전역 헤더 우측: 로그인 상태면 유저 메뉴, 아니면 로그인 버튼. 세션 확인은 요청 때만(Suspense로 감싼다).
export const AuthMenu = async () => {
  const artist = await currentArtist();
  if (artist) {
    return (
      <UserMenu
        name={artist.displayName}
        handle={artist.handle}
        approved={artist.status === "approved"}
        registered
      />
    );
  }

  const social = await currentSocialUser();
  if (social) {
    return <UserMenu name={social.name ?? "작가"} handle={null} approved={false} registered={false} />;
  }

  const admin = await currentAdmin();
  if (admin) {
    return (
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-gray-50"
      >
        <ShieldCheck className="size-4 text-primary" aria-hidden />
        어드민
      </Link>
    );
  }

  return (
    <Link
      href="/artist/login"
      className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-red-600"
    >
      로그인
    </Link>
  );
};

// Suspense fallback.
export const AuthMenuFallback = () => (
  <div className="h-9 w-20 animate-pulse rounded-xl bg-gray-200" />
);
