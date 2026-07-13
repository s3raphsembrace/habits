import type { NextApiRequest, NextApiResponse } from "next";
import { getUserFromRequest, supabaseForRequest } from "@/lib/supabaseServer";

/** DELETE /api/sleep-logs/:id — RLS guarantees users can only delete their own rows. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Not signed in" });

  const id = req.query.id;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const supabase = supabaseForRequest(req);
  const { error } = await supabase.from("sleep_logs").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).end();
}
