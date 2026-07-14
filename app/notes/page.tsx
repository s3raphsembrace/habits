import type { Metadata } from "next";
import JournalEditor from "@/components/JournalEditor";

export const metadata: Metadata = { title: "Journal" };

export default function NotesPage() {
  return <JournalEditor />;
}
