import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.css";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { AppShell, AppShellFallback } from "@/components/app-shell";
import { AuthMenu, AuthMenuFallback } from "@/components/auth-menu";
import "./globals.css";

export const metadata: Metadata = {
  title: "확장 아트 아카이브",
  description: "카드 번호로 포켓몬 카드 확장 아트 도안을 찾는 비영리 아카이브",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-gray-50 text-foreground">
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
        <Toaster
          position="bottom-center"
          richColors
          toastOptions={{ style: { fontFamily: "var(--font-sans)" } }}
        />
      </body>
    </html>
  );
}
