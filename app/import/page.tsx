import type { Metadata } from "next";
import ImportForm from "@/components/ImportForm";

export const metadata: Metadata = { title: "Import sleep data" };

export default function ImportPage() {
  return <ImportForm />;
}
