import { NextResponse } from "next/server";

export const config = {
  matcher: ["/portal/:path*", "/admin/:path*"],
};

// UX-only gate (doc 02 §3): session cookie presence/unseal check for /portal/*
// and role=admin for /admin/*. Real enforcement is server-side per page/action.
// iron-session wiring lands in Phase 2 — no DB imports allowed here (edge sandbox).
export function middleware() {
  return NextResponse.next();
}
