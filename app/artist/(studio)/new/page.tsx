import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NewArtworkForm } from "@/components/admin/NewArtworkForm";
import { currentArtist } from "@/lib/artists";

export const metadata = { title: "도안 올리기 · 확장 아트 아카이브" };

export default function NewArtistArtworkPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">도안 올리기</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-gray-100" />}>
        <Gate />
      </Suspense>
    </div>
  );
}

// 승인된 작가만. dev에서는 로그인 없이도 폼 UI를 미리본다(카드 검색 등 인증 필요한 동작은 로그인 후).
async function Gate() {
  const artist = await currentArtist();
  if (artist) {
    if (artist.status !== "approved") redirect("/artist");
    return <NewArtworkForm mode="artist" />;
  }
  if (process.env.NODE_ENV === "development") {
    return (
      <>
        <p className="rounded-xl bg-accent px-4 py-2.5 text-sm text-accent-foreground">
          미리보기 모드예요 — 카드 검색·업로드는 로그인 후 동작해요.
        </p>
        <NewArtworkForm mode="artist" />
      </>
    );
  }
  redirect("/artist/login");
}
