import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

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
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.from("contact_messages").insert(parsed.data);
  if (error) {
    return NextResponse.json(
      { error: "Could not save your message. Try again later." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
