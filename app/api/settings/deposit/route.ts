import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export async function GET() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("payment_settings")
    .select("deposit_percent")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ deposit_percent: 30 });
  }

  return NextResponse.json({ deposit_percent: data?.deposit_percent ?? 30 });
}
