import Link from "next/link";
import { SignOutButton } from "@/components/signout-button";
import styles from "../admin.module.css";

// 어드민 화면 공통 (design 11A). 접근 확인은 각 화면의 requireAdmin()이 한다.
export default function ConsoleLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className={styles.console}>
      <nav aria-label="어드민" className={styles.nav}>
        <Link href="/admin/artworks">작품</Link>
        <Link href="/admin/artworks/new">작품 등록</Link>
        <Link href="/admin/reports">신고</Link>
        <span className={styles.logout}>
          <SignOutButton callbackUrl="/admin/login" className={styles.linkButton} />
        </span>
      </nav>
      {children}
    </div>
  );
}
