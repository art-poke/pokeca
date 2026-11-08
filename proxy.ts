import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/auth.config";
import { isVisitorId, VISITOR_COOKIE } from "@/lib/visitor";

// edge 인스턴스: edge-safe한 authConfig만으로 만든다(db/bcrypt 없음).
const { auth } = NextAuth(authConfig);

// 어드민·작가 로그인 가드 + 방문자 ID 쿠키.
// 권한 확인은 각 화면·API가 한다(어드민 requireAdmin(), 작가 requireArtist()).
export const proxy = auth((request) => {
  const loggedIn = !!request.auth?.user;
  const { pathname } = request.nextUrl;

  const guard = (area: "/admin" | "/artist", open: string[]) => {
    if (loggedIn || open.includes(pathname)) return withVisitor(request);
    // dev 미리보기: 작가 스튜디오 화면은 로그인 없이도 렌더(페이지가 데모 작가로 보여줌). API는 그대로 막는다.
    const devStudioPreview =
      process.env.NODE_ENV !== "production" && area === "/artist" && !pathname.startsWith("/api/");
    if (devStudioPreview) return withVisitor(request);
    const login = request.nextUrl.clone();
    login.pathname = `${area}/login`;
    login.search = "";
    return NextResponse.redirect(login);
  };

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) return guard("/admin", ["/admin/login"]);
  if (pathname.startsWith("/artist/") || pathname === "/artist" || pathname.startsWith("/api/artist"))
    return guard("/artist", ["/artist/login", "/artist/callback"]);
  return withVisitor(request);
});

// 방문자 ID 쿠키가 없으면 발급한다. 같은 요청의 서버 컴포넌트도 읽을 수 있게 요청 쿠키에도 넣는다.
function withVisitor(request: NextRequest) {
  if (isVisitorId(request.cookies.get(VISITOR_COOKIE)?.value)) return NextResponse.next();
  const id = crypto.randomUUID();
  request.cookies.set(VISITOR_COOKIE, id);
  const res = NextResponse.next({ request: { headers: request.headers } });
  res.cookies.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}

export const config = {
  // /api/auth(Auth.js 엔드포인트)와 정적 파일은 건너뛴다.
  // ⚠️ /api/auth 제외 필수: 미들웨어 auth 래퍼가 signout 응답에 세션 쿠키를 refresh(재발급)해
  //    삭제를 덮어써 로그아웃이 안 됐다. 로그아웃은 이 엔드포인트 경유(components/signout-button).
  matcher: ["/((?!api/auth|_next/|favicon.ico|.*\\.(?:svg|png|jpg|woff2?)$).*)"],
};
