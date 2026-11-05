import { NextResponse, type NextRequest } from "next/server";

// The public site stays available, but the notebook and its APIs are closed until launch.
// Joining the waitlist deliberately does not grant app access.
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/api/waitlist" || path === "/api/waitlist/") return NextResponse.next();
  // The landing page's one live problem (rate-limited, single hardcoded problem).
  if (path === "/api/try" || path === "/api/try/") return NextResponse.next();
  if (path === "/api" || path.startsWith("/api/")) {
    return NextResponse.json({ error: "Tamatar is coming soon. Join the waitlist for early access." }, { status: 403 });
  }
  if (path === "/" || path === "/team" || path === "/team/") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  url.hash = "waitlist";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|logo.png|fonts/|team/team.jpg).*)"],
};
