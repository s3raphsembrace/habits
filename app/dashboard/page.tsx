import type { Metadata } from "next";
import DashboardView from "@/components/DashboardView";

export const metadata: Metadata = { title: "Dashboard" };

// Middleware (middleware.ts) already redirected unauthenticated visitors,
// so this page only renders for signed-in users.
export default function DashboardPage() {
  return <DashboardView />;
}
