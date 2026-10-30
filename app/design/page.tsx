import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 디자인시스템 빠른 확인용 갤러리. 정식 카탈로그는 Storybook.
export default function DesignGalleryPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-12 p-6 md:p-10">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="inline-block size-7 rounded-full bg-primary ring-4 ring-ink-900" />
          <h1 className="font-display text-3xl font-bold text-foreground">
            art-poke 디자인시스템
          </h1>
        </div>
        <p className="text-muted-foreground">몬스터볼 테마 · 레드 · 화이트 · 블랙</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">컬러 토큰</h2>
        <div className="flex flex-wrap gap-2">
          {["bg-red-50", "bg-red-100", "bg-red-300", "bg-red-500", "bg-red-700", "bg-red-900"].map(
            (c) => (
              <div key={c} className={`${c} flex size-16 items-end rounded-lg p-1`}>
                <span className="rounded bg-white/70 px-1 text-[10px]">{c.replace("bg-", "")}</span>
              </div>
            ),
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {["bg-ink-900", "bg-ink-700", "bg-ink-500", "bg-gray-200", "bg-gray-100", "bg-gray-50"].map(
            (c) => (
              <div key={c} className={`${c} flex size-16 items-end rounded-lg border border-border p-1`}>
                <span className="rounded bg-white/70 px-1 text-[10px]">{c.replace("bg-", "")}</span>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Button</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">프라이머리</Button>
          <Button variant="secondary">세컨더리</Button>
          <Button variant="outline">아웃라인</Button>
          <Button variant="ghost">고스트</Button>
          <Button variant="destructive">위험</Button>
          <Button variant="link">링크</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Input</h2>
        <div className="max-w-sm space-y-3">
          <Input placeholder="카드 번호 또는 이름 (예: sv2a 201/165)" />
          <Input placeholder="비활성" disabled />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Badge</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary">SAR</Badge>
          <Badge variant="secondary">9포켓</Badge>
          <Badge variant="soft">PSA</Badge>
          <Badge variant="muted">BRG</Badge>
          <Badge variant="outline">전체</Badge>
        </div>
      </section>
    </div>
  );
}
