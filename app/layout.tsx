import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.css";
import { Suspense } from "react";
import { AnalyticsTracker } from "@/lib/analytics/tracker";
import { Toaster } from "sonner";
import { AppShell, AppShellFallback } from "@/components/app-shell";
import { AuthMenu, AuthMenuFallback } from "@/components/auth-menu";
import { QueryProvider } from "@/lib/query/query-client";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://d3mfru6qnveki4.cloudfront.net";
const DESCRIPTION = "카드 번호로 포켓몬 카드 확장 아트 도안을 찾는 비영리 아카이브";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Extended Art Archive",
  description: DESCRIPTION,
  // 개별 페이지에 공유 정보가 없을 때 사용할 사이트 기본 미리보기.
  openGraph: {
    type: "website",
    siteName: "Extended Art Archive",
    title: "Extended Art Archive",
    description: DESCRIPTION,
    locale: "ko_KR",
    images: [{ url: "/og-home.png", width: 1200, height: 630, alt: "Extended Art Archive" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Extended Art Archive",
    description: DESCRIPTION,
    images: ["/og-home.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-gray-50 text-foreground">
        <QueryProvider>
          <Suspense fallback={<AppShellFallback />}>
            <AppShell
              auth={
                <Suspense fallback={<AuthMenuFallback />}>
                  <AuthMenu />
                </Suspense>
              }
            >
              {children}
            </AppShell>
          </Suspense>
        </QueryProvider>
        <Suspense fallback={null}><AnalyticsTracker /></Suspense>
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            style: {
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              boxShadow: "0 8px 30px rgb(0 0 0 / 0.16)",
            },
          }}
        />
      </body>
    </html>
  );
}
