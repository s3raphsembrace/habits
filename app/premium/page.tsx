import type { Metadata } from "next";
import PremiumPanel from "@/components/PremiumPanel";

export const metadata: Metadata = { title: "Premium" };

export default function PremiumPage() {
  return <PremiumPanel />;
}
