import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getDefaultUserId } from "@/lib/user-context";

export async function GET() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { ready: false, error: "Supabase nao configurado no ambiente server." },
      { status: 500 },
    );
  }

  const userId = getDefaultUserId();
  const result = await supabase.from("conversations").select("id").eq("user_id", userId).limit(1);
  if (result.error) {
    return NextResponse.json(
      {
        ready: false,
        error: result.error.message,
        hint: "Verifique URL, service role key e se o schema SQL foi aplicado no Supabase.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ready: true });
}
