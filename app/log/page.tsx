import type { Metadata } from "next";
import LogForm from "@/components/LogForm";

export const metadata: Metadata = { title: "Log sleep" };

export default function LogPage() {
  return <LogForm />;
}
