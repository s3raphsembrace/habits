"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", authed: true },
  { href: "/log", label: "Log sleep", authed: true },
  { href: "/notes", label: "Journal", authed: true },
  { href: "/import", label: "Import", authed: true },
  { href: "/premium", label: "Premium", authed: true },
  { href: "/library", label: "Library", authed: false },
  { href: "/contact", label: "Contact", authed: false },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      setSignedIn(Boolean(session))
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="site-header">
      <nav className="nav">
        <Link href="/" className="brand">
          🌙 Habits
        </Link>
        <div className="nav-links">
          {NAV_LINKS.filter((l) => !l.authed || signedIn).map((l) => (
            <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
              {l.label}
            </Link>
          ))}
          {signedIn ? (
            <button className="link-button" onClick={signOut}>
              Sign out
            </button>
          ) : (
            <Link href="/login" className={pathname === "/login" ? "active" : ""}>
              Sign in
            </Link>
          )}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
