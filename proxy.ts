import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isVisitorId, VISITOR_COOKIE } from "@/lib/visitor";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return session(request, "/admin", ["/admin/login"]);
  }
  if (pathname.startsWith("/artist/") || pathname === "/artist" || pathname.startsWith("/api/artist")) {
    return session(request, "/artist", ["/artist/login", "/artist/callback"]);
  }
  return visitor(request);
}

// 방문자 ID 쿠키가 없으면 발급한다. 같은 요청의 서버 컴포넌트도 읽을 수 있게 요청 쿠키에도 넣는다.
function visitor(request: NextRequest) {
  if (isVisitorId(request.cookies.get(VISITOR_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const id = crypto.randomUUID();
  request.cookies.set(VISITOR_COOKIE, id);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return response;
}

// 어드민·작가 로그인 세션 갱신. 서버 컴포넌트는 쿠키를 쓸 수 없어서 만료된 토큰을 여기서 새로 받아 둔다.
// 로그인하지 않은 화면 요청은 그 영역의 로그인으로 보낸다.
// 권한 확인은 각 화면·API가 한다(어드민 requireAdmin(), 작가 requireArtist()).
async function session(request: NextRequest, area: "/admin" | "/artist", open: string[]) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && pathname.startsWith(area) && !open.includes(pathname)) {
    // dev 미리보기: 작가 스튜디오 화면은 로그인 없이도 렌더(페이지가 데모 작가로 보여줌). API는 그대로 막는다.
    const devStudioPreview =
      process.env.NODE_ENV !== "production" && area === "/artist" && !pathname.startsWith("/api/");
    if (!devStudioPreview) {
      const login = request.nextUrl.clone();
      login.pathname = `${area}/login`;
      login.search = "";
      return NextResponse.redirect(login);
    }
  }
  return response;
}

export const config = {
  // 정적 파일은 건너뛴다.
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|woff2?)$).*)"],
};
