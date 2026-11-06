import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GoogleIcon, KakaoIcon } from "@/components/ui/brand-icons";
import { PokeballMark } from "@/components/ui/logo";
import { currentSocialUser } from "@/lib/artists";
import { socialLogin } from "../actions";

export const metadata = { title: "로그인 · Extended Art Archive" };

// 로그인은 카카오·구글뿐. 로그인하면 누구나 작품을 저장하고 곧 작가가 된다(마이페이지에서 주소 이름 설정).
// 이미 로그인했으면 로그인 버튼을 보이지 않게 /me로 보낸다(다른 provider 링크=계정 머지 방지).
export default async function LoginPage(props: PageProps<"/artist/login">) {
  if (await currentSocialUser()) redirect("/me");
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center py-4 md:py-8">
      <CardShowcase />

      <div className="w-full rounded-2xl border border-border bg-background p-6 shadow-sm md:p-8">
        <div className="flex flex-col items-center text-center">
          <PokeballMark className="size-10" />
          <h1 className="mt-3 font-display text-2xl font-bold text-foreground">로그인</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            로그인하면 마음에 든 확장 아트를 저장하고,
            <br className="hidden sm:inline" />
            직접 만든 도안도 올려 내 작가 페이지에 모을 수 있어요.
          </p>
        </div>

        <Suspense>
          <Failed searchParams={props.searchParams} />
        </Suspense>

        <form action={socialLogin} className="mt-6 flex flex-col gap-3">
          <button
            type="submit"
            name="provider"
            value="kakao"
            className="relative flex h-12 w-full items-center justify-center rounded-xl bg-[var(--color-kakao)] px-12 text-[15px] font-semibold text-[var(--color-kakao-ink)] transition-opacity hover:opacity-90 active:scale-[0.99]"
          >
            <KakaoIcon className="absolute left-4 size-5" />
            카카오로 계속하기
          </button>
          <button
            type="submit"
            name="provider"
            value="google"
            className="relative flex h-12 w-full items-center justify-center rounded-xl border border-[var(--color-google-rule)] bg-[var(--color-google)] px-12 text-[15px] font-semibold text-[var(--color-google-ink)] transition-colors hover:bg-gray-50 active:scale-[0.99]"
          >
            <GoogleIcon className="absolute left-4 size-5" />
            구글로 계속하기
          </button>
        </form>

        <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
          이름(닉네임)과 이메일만 받아요. 비밀번호는 저장하지 않아요.
        </p>
      </div>
    </div>
  );
}

// 로그인 화면 장식: 몬스터볼 테마의 카드 뒷면을 부채꼴로 펼쳐 아카이브(카드 수집) 분위기를 낸다.
// 공식 카드 이미지에 의존하지 않아 어떤 환경에서도 깨지지 않는다.
const FAN = [-2, -1, 0, 1, 2] as const;

const CardShowcase = () => (
  <div className="relative mb-10 flex h-44 w-full items-center justify-center" aria-hidden>
    {FAN.map((offset) => (
      <div
        key={offset}
        className="absolute aspect-[63/88] w-24 rounded-xl border border-black/10 bg-gradient-to-b from-red-500 to-red-700 p-1.5 shadow-md"
        style={{
          transform: `rotate(${offset * 8}deg) translateX(${offset * 46}px) translateY(${Math.abs(offset) * 12}px)`,
          zIndex: 10 - Math.abs(offset),
        }}
      >
        <div className="flex size-full flex-col items-center justify-center gap-2 rounded-lg border border-white/25">
          <CardBackMark />
          <span className="font-display text-[10px] font-bold uppercase tracking-widest text-white/80">
            Art
          </span>
        </div>
      </div>
    ))}
  </div>
);

// 카드 뒷면 중앙의 흰색 몬스터볼 엠블럼(레드 바탕 위).
const CardBackMark = () => (
  <svg viewBox="0 0 40 40" className="size-9 text-white" aria-hidden>
    <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="2.4" />
    <line x1="3" y1="20" x2="37" y2="20" stroke="currentColor" strokeWidth="2.4" />
    <circle cx="20" cy="20" r="6" fill="currentColor" />
    <circle cx="20" cy="20" r="2.6" className="fill-red-600" />
  </svg>
);

async function Failed({ searchParams }: { searchParams: PageProps<"/artist/login">["searchParams"] }) {
  if (!(await searchParams).error) return null;
  return (
    <p className="mt-5 rounded-lg bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-foreground">
      로그인하지 못했어요. 다시 시도해 주세요.
    </p>
  );
}
