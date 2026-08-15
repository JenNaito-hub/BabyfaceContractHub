import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  // Video Studio là app độc lập: không dùng auth/data của khu /talent.
  // Bỏ qua luôn để nó chạy được kể cả khi chưa cấu hình Supabase.
  if (pathname.startsWith("/video") || pathname.startsWith("/api/video")) {
    return supabaseResponse;
  }

  // Thiếu env Supabase thì không dựng client (sẽ throw) — để request đi tiếp.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = pathname.startsWith("/talent");
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");

  // Chưa đăng nhập mà vào khu vực bảo vệ → đẩy về /login
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Đã đăng nhập mà vào /login → đẩy vào dashboard
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/talent";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
