import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every matched request:
 * 1. Refreshes the Supabase session cookie if it expired (keeps server
 *    components and route handlers seeing a live session).
 * 2. Server-side gate for signed-in-only pages — unauthenticated visitors
 *    are redirected to /login before any page code runs. This replaces the
 *    old client-side useEffect redirect, which only hid content after load.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // Match whole segments only — startsWith("/log") would also catch "/login"
  // and send logged-out visitors into a redirect loop.
  const needsAuth = ["/dashboard", "/log", "/notes", "/import"].some(
    (p) => path === p || path.startsWith(`${p}/`)
  );

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/log/:path*", "/notes/:path*", "/import/:path*", "/login"],
};
