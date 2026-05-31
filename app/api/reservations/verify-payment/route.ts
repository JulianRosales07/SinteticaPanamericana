import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getWompiApiBaseUrl, getWompiEnv, getWompiPublicKey } from "../../../../lib/wompi";

/**
 * Verifica el estado de pago de una reserva consultando directamente a Wompi
 * y sincroniza la BD si el webhook no llegó.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const reservationId = body?.reservationId;

  if (!reservationId) {
    return NextResponse.json({ error: "reservationId es requerido" }, { status: 400 });
  }

  // Verificar autenticación
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  // Obtener la reserva
  const { data: reservation, error: fetchErr } = await admin
    .from("reservations")
    .select("id, user_id, status, deposit_paid, deposit_payment_reference, wompi_transaction_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (fetchErr || !reservation) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  if (reservation.user_id !== user.id) {
    return NextResponse.json({ error: "No tienes permiso" }, { status: 403 });
  }

  // Si ya está activa/pagada, no hay nada que hacer
  if (reservation.deposit_paid && reservation.status === "active") {
    return NextResponse.json({ success: true, status: "active", message: "La reserva ya está confirmada." });
  }

  // Buscar el pago asociado a esta reserva
  const { data: payment } = await admin
    .from("reservation_payments")
    .select("reference, status, wompi_transaction_id")
    .eq("reservation_id", reservationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payment) {
    return NextResponse.json({ error: "No se encontró un intento de pago para esta reserva." }, { status: 404 });
  }

  // Si ya tenemos el transaction_id de Wompi, consultar directamente
  // Si no, intentar buscar por reference
  const publicKey = getWompiPublicKey();
  if (!publicKey) {
    return NextResponse.json({ error: "Faltan llaves de Wompi" }, { status: 500 });
  }

  const env = getWompiEnv();
  const baseUrl = getWompiApiBaseUrl(env);

  let txStatus: string | null = null;
  let txId: string | null = payment.wompi_transaction_id;

  if (txId) {
    // Consultar por transaction ID
    const resp = await fetch(`${baseUrl}/transactions/${encodeURIComponent(txId)}`, {
      headers: { Authorization: `Bearer ${publicKey}` },
      cache: "no-store",
    });
    const json = await resp.json();
    txStatus = json?.data?.status ?? null;
  }

  // Si no tenemos txId o el status sigue PENDING, intentar buscar por reference
  if (!txStatus || txStatus === "PENDING") {
    // Wompi no tiene endpoint de búsqueda por reference con public key,
    // así que si no hay txId, no podemos sincronizar automáticamente
    if (!txId) {
      return NextResponse.json({
        success: false,
        status: payment.status,
        message: "El pago aún está en proceso. Si ya pagaste, espera unos minutos e intenta de nuevo.",
      });
    }
  }

  if (!txStatus) {
    return NextResponse.json({
      success: false,
      status: "PENDING",
      message: "No se pudo verificar el estado con Wompi. Intenta de nuevo en unos minutos.",
    });
  }

  // Sincronizar estado en la BD
  // 1. Actualizar payment
  await admin
    .from("reservation_payments")
    .update({
      status: txStatus,
      wompi_transaction_id: txId,
      updated_at: new Date().toISOString(),
    })
    .eq("reference", payment.reference);

  // 2. Actualizar reserva
  const patch: Record<string, any> = {
    deposit_status: txStatus,
    wompi_transaction_id: txId,
  };

  if (txStatus === "APPROVED") {
    patch.deposit_paid = true;
    patch.deposit_paid_at = new Date().toISOString();
    patch.status = "active";
  } else if (["DECLINED", "VOIDED", "ERROR"].includes(txStatus)) {
    patch.status = "cancelled";
  }

  await admin.from("reservations").update(patch).eq("id", reservationId);

  const statusMessages: Record<string, string> = {
    APPROVED: "¡Pago confirmado! Tu reserva está activa.",
    DECLINED: "El pago fue rechazado. La reserva fue liberada.",
    VOIDED: "El pago fue anulado. La reserva fue liberada.",
    ERROR: "Hubo un error en el pago. La reserva fue liberada.",
    PENDING: "El pago sigue en proceso. Intenta de nuevo en unos minutos.",
  };

  return NextResponse.json({
    success: txStatus === "APPROVED",
    status: txStatus,
    message: statusMessages[txStatus] ?? `Estado del pago: ${txStatus}`,
  });
}
