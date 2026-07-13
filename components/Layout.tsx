import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode } from "react";
import { useSession } from "@/lib/useSession";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", authed: true },
  { href: "/log", label: "Log sleep", authed: true },
  { href: "/library", label: "Library", authed: false },
  { href: "/contact", label: "Contact", authed: false },
];

export default function Layout({ title, children }: { title: string; children: ReactNode }) {
  const { session } = useSession();
  const router = useRouter();

  async function signOut() {
    await getSupabaseBrowser().auth.signOut();
    router.push("/");
  }

  return (
    <>
      <Head>
        <title>{`${title} · Somnia`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Track your sleep debt, find your melatonin window, and build better sleep habits." />
      </Head>
      <header className="site-header">
        <nav className="nav">
          <Link href="/">
            <a className="brand">🌙 Somnia</a>
          </Link>
          <div className="nav-links">
            {NAV_LINKS.filter((l) => !l.authed || session).map((l) => (
              <Link key={l.href} href={l.href}>
                <a className={router.pathname === l.href ? "active" : ""}>{l.label}</a>
              </Link>
            ))}
            {session ? (
              <button className="link-button" onClick={signOut}>
                Sign out
              </button>
            ) : (
              <Link href="/login">
                <a className={router.pathname === "/login" ? "active" : ""}>Sign in</a>
              </Link>
            )}
          </div>
        </nav>
      </header>
      <main className="container">{children}</main>
      <footer className="site-footer">
        Somnia is an educational tool, not medical advice. Talk to a doctor about persistent sleep problems.
      </footer>
    </>
  );
}
