import type { Metadata } from "next";
import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import ThemePresetApplier from "@/components/ThemePresetApplier";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Habits: Sleep Quality — sleep debt & energy tracker",
    template: "%s · Habits: Sleep Quality",
  },
  description:
    "Track your sleep debt, find your melatonin window, and build better sleep habits.",
};

// Applies the saved theme before first paint so there is no flash of the
// wrong theme. Light is the default; only an explicit "dark" changes it.
const themeInit = `try{if(localStorage.getItem("theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <ThemePresetApplier />
        <Nav />
        <main className="container">{children}</main>
        <footer className="site-footer">
          Habits: Sleep Quality is an educational tool, not medical advice. Talk to a doctor about
          persistent sleep problems.
        </footer>
      </body>
    </html>
  );
}
