import type { Metadata } from "next";
import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Somnia — sleep debt & energy tracker",
    template: "%s · Somnia",
  },
  description:
    "Track your sleep debt, find your melatonin window, and build better sleep habits.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="container">{children}</main>
        <footer className="site-footer">
          Somnia is an educational tool, not medical advice. Talk to a doctor about persistent
          sleep problems.
        </footer>
      </body>
    </html>
  );
}
