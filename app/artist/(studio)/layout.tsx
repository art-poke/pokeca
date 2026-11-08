import Link from "next/link";
import { SignOutButton } from "@/components/signout-button";

// 작가 화면 공통. 접근 확인은 각 화면의 requireArtist()가 한다(dev 미리보기 예외).
export default function StudioLayout({ children }: LayoutProps<"/artist">) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-1 border-b border-border">
        <Link
          href="/artist"
          className="px-3 py-2.5 text-sm font-semibold text-ink-700 hover:text-foreground"
        >
          내 스튜디오
        </Link>
        <Link
          href="/artist/new"
          className="px-3 py-2.5 text-sm font-semibold text-ink-700 hover:text-foreground"
        >
          도안 올리기
        </Link>
        <SignOutButton
          callbackUrl="/artist/login"
          className="ml-auto px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        />
      </div>
      {children}
    </div>
  );
}
