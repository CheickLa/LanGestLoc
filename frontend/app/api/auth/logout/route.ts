import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, LOGIN_PATH } from "@/lib/auth";

export function GET(request: Request): NextResponse {
  const response = NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  response.cookies.set(AUTH_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}
