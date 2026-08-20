import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";
import {
  getSitePassword,
  isValidSiteAccessToken,
  sanitizeReturnPath,
  SITE_ACCESS_COOKIE,
} from "@/lib/site-access";

function isUnlockPath(pathname: string): boolean {
  return pathname === "/unlock";
}

function isSettingsPath(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sitePassword = getSitePassword();

  if (sitePassword) {
    const hasAccess = isValidSiteAccessToken(
      request.cookies.get(SITE_ACCESS_COOKIE)?.value,
    );

    if (isUnlockPath(pathname)) {
      if (hasAccess) {
        const from = sanitizeReturnPath(request.nextUrl.searchParams.get("from"));
        return NextResponse.redirect(new URL(from, request.url));
      }
      return NextResponse.next();
    }

    if (!hasAccess) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Password required." },
          { status: 401 },
        );
      }

      const unlock = new URL("/unlock", request.url);
      const from = `${pathname}${request.nextUrl.search}`;
      if (from !== "/") {
        unlock.searchParams.set("from", from);
      }
      return NextResponse.redirect(unlock);
    }
  } else if (isUnlockPath(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isSettingsPath(pathname) && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
