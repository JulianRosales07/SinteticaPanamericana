"use server";

import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function deleteReservationAdminAction(id: string) {
  // Opcional: verificar que el usuario actual es admin
  const supabaseAuth = await createSupabaseServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  if (!user) {
    return { success: false, error: "No autenticado" };
  }

  // Verificar rol de administrador
  const { data: profile } = await supabaseAuth
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { success: false, error: "No tienes permisos de administrador" };
  }

  // Usar el cliente Admin para saltarse las restricciones (RLS)
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.from("reservations").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
