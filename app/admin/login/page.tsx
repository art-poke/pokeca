import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import styles from "../admin.module.css";

export const metadata = { title: "어드민 로그인 · Extended Art Archive" };

// 어드민 계정은 Supabase 대시보드에서 만들고 admins 표에 넣는다(공개 가입 없음).
export default function LoginPage(props: PageProps<"/admin/login">) {
  return (
    <section className={styles.narrow}>
      <h1 className={styles.title}>어드민 로그인</h1>
      <Suspense>
        <Denied searchParams={props.searchParams} />
      </Suspense>
      <LoginForm />
    </section>
  );
}

async function Denied({ searchParams }: { searchParams: PageProps<"/admin/login">["searchParams"] }) {
  if (!(await searchParams).denied) return null;
  return <p className={styles.error}>이 계정은 어드민 목록에 없어요. 다른 계정으로 로그인하세요.</p>;
}
