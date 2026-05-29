import { createClient } from "@supabase/supabase-js";

/**
 * Cliente admin (service role) para operaciones server-side:
 * - Webhooks (no hay usuario autenticado)
 * - Lectura de settings protegidos por RLS
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new Error(
      "Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY en el servidor."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

