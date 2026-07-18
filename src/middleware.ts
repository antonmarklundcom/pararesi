import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { getSessionOptions, type SessionData } from "@/lib/session";

// UX-only gate. Every gated layout/page/action still re-checks with
// requireUser/requireTier/requireAdmin server-side (docs/02-architecture.md §3) —
// this only saves a redirect round-trip and avoids flashing gated UI.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, getSessionOptions());

  const isAdminRoute = pathname.startsWith("/admin");
  const isPortalRoute = pathname.startsWith("/portal");

  if (!isAdminRoute && !isPortalRoute) {
    return response;
  }

  if (!session.userId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && session.role !== "admin") {
    return NextResponse.redirect(new URL("/portal", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/portal/:path*", "/admin/:path*"],
};
