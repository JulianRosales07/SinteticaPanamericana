import { NextResponse } from "next/server";
import { getWompiApiBaseUrl, getWompiEnv, getWompiPublicKey } from "../../../../lib/wompi";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id es requerido" }, { status: 400 });
  }

  const publicKey = getWompiPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { error: "Faltan llaves de Wompi (Prueba o Producción)" },
      { status: 500 },
    );
  }

  const env = getWompiEnv();
  const baseUrl = getWompiApiBaseUrl(env);

  const resp = await fetch(`${baseUrl}/transactions/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${publicKey}`,
    },
    cache: "no-store",
  });

  const json = await resp.json();
  
  // Sincronización de respaldo:
  // Si el webhook falla (por ej. si estás usando localhost/ngrok y no lo has configurado),
  // actualizamos la base de datos aquí mismo cuando el usuario regresa a la página de éxito.
  if (json?.data?.reference && json?.data?.status) {
    const tx = json.data;
    const reference = tx.reference;
    const status = tx.status;
    const admin = createSupabaseAdminClient();

    // 1. Actualizar el pago
    const { data: payRow } = await admin
      .from("reservation_payments")
      .update({
        status,
        wompi_transaction_id: tx.id,
        updated_at: new Date().toISOString(),
      })
      .eq("reference", reference)
      .select("reservation_id")
      .maybeSingle();

    // 2. Actualizar la reserva si encontramos el pago
    if (payRow?.reservation_id) {
      const patch: Record<string, any> = {
        deposit_status: status,
        wompi_transaction_id: tx.id,
      };
      if (status === "APPROVED") {
        patch.deposit_paid = true;
        patch.deposit_paid_at = new Date().toISOString();
        patch.status = "active"; // Activar reserva solo cuando el pago es exitoso
      } else if (["DECLINED", "VOIDED", "ERROR"].includes(status)) {
        patch.status = "cancelled"; // Liberar el horario si el pago falla
      }
      const { error: updateErr } = await admin.from("reservations").update(patch).eq("id", payRow.reservation_id);
      // Si falla por conflicto de unicidad (otro usuario ya reservó ese slot), cancelar
      if (updateErr && (updateErr as any).code === "23505") {
        await admin.from("reservations").update({ status: "cancelled", deposit_status: status }).eq("id", payRow.reservation_id);
      }
    }
  }

  return NextResponse.json(json, { status: resp.status });
}

