import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { siteContactEmail } from "@/lib/site-contact";

const footerGroups = [
  {
    label: "둘러보기",
    links: [
      { href: "/search", label: "카드 검색" },
      { href: "/stories", label: "카드 이야기" },
      { href: "/community", label: "커뮤니티" },
    ],
  },
  {
    label: "참여하기",
    links: [
      { href: "/requests", label: "도안 요청" },
      { href: "/artist/login", label: "작가로 도안 올리기" },
      { href: "/terms#rights", label: "권리 침해·내림 안내" },
    ],
  },
] as const;

const footerLinkClass = "inline-flex min-h-9 items-center hover:text-foreground hover:underline underline-offset-4";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background text-sm text-muted-foreground">
      <div className="mx-auto max-w-[1120px] px-4 md:px-6">
        <div className="grid gap-6 py-8 md:grid-cols-[minmax(0,1fr)_minmax(17rem,0.9fr)] md:gap-8 md:py-10">
          <div className="min-w-0">
            <Link href="/" aria-label="Extended Art Archive 홈" className="inline-flex max-w-full">
              <Logo />
            </Link>
            <p className="mt-3 max-w-xs leading-relaxed">
              카드 번호로 포켓몬 카드 확장 아트 도안을 찾는 비영리 팬 아카이브입니다.
            </p>
            {siteContactEmail && (
              <p className="mt-2">
                <a href={`mailto:${siteContactEmail}`} className={`${footerLinkClass} [overflow-wrap:anywhere]`}>
                  {siteContactEmail}
                </a>
              </p>
            )}
          </div>

          <nav aria-label="푸터 바로가기" className="grid grid-cols-2 gap-x-4">
            {footerGroups.map(({ label, links }) => (
              <div key={label}>
                <p className="mb-1 font-semibold text-foreground">{label}</p>
                <ul>
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} prefetch={false} className={footerLinkClass}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-x-6 gap-y-1 border-t border-border py-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <p>도안의 권리는 각 아티스트에게 있습니다.</p>
          <nav aria-label="서비스 정책" className="flex flex-wrap gap-x-5">
            <Link href="/terms" className={footerLinkClass}>이용약관</Link>
            <Link href="/privacy" className={`${footerLinkClass} font-semibold text-foreground`}>
              개인정보처리방침
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
