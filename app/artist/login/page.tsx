import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentSocialUser } from "@/lib/artists";
import { socialLogin } from "../actions";
import styles from "@/app/admin/admin.module.css";

export const metadata = { title: "작가 로그인 · 확장 아트 아카이브" };

// 작가 로그인은 카카오·구글뿐이다. 로그인하면 누구나 곧 작가(마이페이지에서 주소 이름 설정).
// 이미 로그인했으면 로그인 버튼을 보이지 않게 /me로 보낸다(다른 provider 링크=계정 머지 방지).
export default async function ArtistLoginPage(props: PageProps<"/artist/login">) {
  if (await currentSocialUser()) redirect("/me");
  return (
    <section className={styles.narrow}>
      <h1 className={styles.title}>작가 로그인</h1>
      <p>직접 만든 확장 아트 도안을 올리고 내 작가 페이지에 모을 수 있어요. 로그인하면 마이페이지에서 주소 이름만 정하면 바로 올릴 수 있어요.</p>
      <Suspense>
        <Failed searchParams={props.searchParams} />
      </Suspense>
      <form action={socialLogin} className={styles.form}>
        <button type="submit" name="provider" value="kakao" className={styles.kakao}>
          카카오로 계속하기
        </button>
        <button type="submit" name="provider" value="google" className={styles.google}>
          구글로 계속하기
        </button>
      </form>
      <p className={styles.muted}>로그인하면 이름(닉네임)과 이메일만 받아요. 비밀번호는 저장하지 않아요.</p>
    </section>
  );
}

async function Failed({ searchParams }: { searchParams: PageProps<"/artist/login">["searchParams"] }) {
  if (!(await searchParams).error) return null;
  return <p className={styles.error}>로그인하지 못했어요. 다시 시도해 주세요.</p>;
}
