import { redirect } from "next/navigation";

// 유저=작가 통합: 작가 스튜디오는 마이페이지(/me)로 합쳐졌다.
export default function StudioPage() {
  redirect("/me");
}
