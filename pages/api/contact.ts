import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { supabaseForRequest } from "@/lib/supabaseServer";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(200),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000),
});

/**
 * POST /api/contact — public endpoint (no auth). Server-side zod validation
 * mirrors the client-side checks; the DB constraints are the final backstop.
 * The contact_messages table has no public SELECT policy, so submissions are
 * write-only from the internet.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }

  const supabase = supabaseForRequest(req);
  const { error } = await supabase.from("contact_messages").insert(parsed.data);
  if (error) return res.status(500).json({ error: "Could not save your message. Try again later." });

  return res.status(201).json({ ok: true });
}
