"use client";

import {
  Activity,
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronRight,
  Flag,
  GalleryHorizontalEnd,
  LayoutDashboard,
  LogOut,
  PanelsTopLeft,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/signout-button";
import s from "./analytics/dashboard.module.css";

const sections = [
  {
    name: "분석",
    items: [
      { href: "/admin", label: "대시보드", icon: LayoutDashboard },
      { href: "/admin/insights", label: "인사이트", icon: ChartNoAxesCombined },
    ],
  },
  {
    name: "운영",
    items: [
      { href: "/admin/users", label: "회원", icon: UsersRound },
      { href: "/admin/artworks", label: "작품", icon: GalleryHorizontalEnd },
      { href: "/admin/reports", label: "신고", icon: Flag },
    ],
  },
];
export function AdminShell({
  children,
  preview,
}: {
  children: React.ReactNode;
  preview: boolean;
}) {
  const path = usePathname();
  const active = (href: string) =>
    path === href || (href !== "/admin" && path.startsWith(href + "/"));
  const current = sections
    .flatMap((group) => group.items)
    .find((item) => active(item.href));
  return (
    <div className={s.shell}>
      <aside className={s.sidebar}>
        <Link href="/admin" className={s.brand} aria-label="Artpoke 운영 홈">
          <span>
            <Activity size={23} />
          </span>{" "}
          Artpoke<span className={s.brandSuffix}>Console</span>
        </Link>
        <nav aria-label="어드민" className={s.nav}>
          {sections.map((group) => (
            <div key={group.name}>
              <p>{group.name}</p>
              {group.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={active(href) ? "page" : undefined}
                >
                  <Icon size={17} />
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className={s.sidebarBottom}>
          <Link href="/">
            서비스로 이동 <ArrowUpRight size={15} />
          </Link>
          {!preview && (
            <SignOutButton callbackUrl="/admin/login">
              <LogOut size={15} /> 로그아웃
            </SignOutButton>
          )}
        </div>
      </aside>
      <div className={s.workspace}>
        <header className={s.topbar}>
          <span>
            <PanelsTopLeft size={16} /> 워크스페이스 <ChevronRight size={13} />{" "}
            <b>{current?.label}</b>
          </span>
          <span className={s.environment}>
            <i />
            {preview ? "로컬 샘플 데이터" : "운영 콘솔"}
          </span>
        </header>
        <div className={s.content}>{children}</div>
      </div>
    </div>
  );
}
