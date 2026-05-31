import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { voidTransaction } from "../../../../lib/wompi";

export async function POST(request: Request) {
  const body = await request.json();
  const reservationId = body?.reservationId;

  if (!reservationId) {
    return NextResponse.json(
      { error: "reservationId es requerido" },
      { status: 400 }
    );
  }

  // 1) Verificar autenticación
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // 2) Obtener la reserva (verificar que pertenece al usuario)
  const admin = createSupabaseAdminClient();
  const { data: reservation, error: fetchErr } = await admin
    .from("reservations")
    .select("id, user_id, court_id, date, hour, price_cop, status, deposit_paid, deposit_cop, wompi_transaction_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (fetchErr || !reservation) {
    return NextResponse.json(
      { error: "Reserva no encontrada" },
      { status: 404 }
    );
  }

  // Verificar propiedad
  if (reservation.user_id !== user.id) {
    return NextResponse.json(
      { error: "No tienes permiso para cancelar esta reserva" },
      { status: 403 }
    );
  }

  // 3) Verificar que está en un status cancelable
  if (!["active", "pending_payment"].includes(reservation.status)) {
    return NextResponse.json(
      { error: "Esta reserva no se puede cancelar (ya está cancelada o en un estado no válido)" },
      { status: 400 }
    );
  }

  // 4) Validar regla de 24h
  const reservationDateTime = new Date(`${reservation.date}T${String(reservation.hour).padStart(2, "0")}:00:00`);
  const now = new Date();
  const hoursUntilReservation = (reservationDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilReservation < 24) {
    return NextResponse.json(
      { error: "No se puede cancelar con menos de 24 horas de antelación. Contacta al administrador." },
      { status: 400 }
    );
  }

  // 5) Intentar reembolso si el anticipo fue pagado
  let refundResult: { attempted: boolean; success: boolean; error?: string } = {
    attempted: false,
    success: false,
  };

  if (reservation.deposit_paid && reservation.wompi_transaction_id) {
    refundResult.attempted = true;
    const voidRes = await voidTransaction(reservation.wompi_transaction_id);
    refundResult.success = voidRes.success;
    if (!voidRes.success) {
      refundResult.error = voidRes.error;
    }
  }

  // 6) Cancelar la reserva (incluso si el void falla, liberamos el horario)
  const patch: Record<string, any> = {
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    cancelled_by: "user",
  };

  if (refundResult.attempted) {
    patch.refund_status = refundResult.success ? "refunded" : "refund_failed";
  }

  const { error: updateErr } = await admin
    .from("reservations")
    .update(patch)
    .eq("id", reservationId);

  if (updateErr) {
    return NextResponse.json(
      { error: updateErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    refund: refundResult.attempted
      ? {
          attempted: true,
          success: refundResult.success,
          message: refundResult.success
            ? "El anticipo será reembolsado a tu método de pago en 3-5 días hábiles."
            : "No se pudo procesar el reembolso automáticamente. El administrador gestionará tu reembolso.",
        }
      : { attempted: false, message: "No había anticipo pagado." },
  });
}
