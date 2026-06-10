import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { AUTH_COOKIE_NAME, DEFAULT_AUTHENTICATED_PATH, LOGIN_PATH } from "@/lib/auth";

export function proxy(request: NextRequest): NextResponse {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isLoginPage = request.nextUrl.pathname === LOGIN_PATH;

  if (!token && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    return NextResponse.redirect(url);
  }

  if (token && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = DEFAULT_AUTHENTICATED_PATH;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
