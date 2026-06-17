import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

/**
 * POST /api/reservations/renew
 *
 * Crea una copia de una reserva existente para la misma cancha y hora
 * pero una semana después (cliente fiel). Solo admins pueden usarlo.
 *
 * Body: { reservationId: string }
 */
export async function POST(request: Request) {
  const body = await request.json();
  const reservationId = body?.reservationId as string | undefined;

  if (!reservationId) {
    return NextResponse.json(
      { error: "reservationId es requerido" },
      { status: 400 }
    );
  }

  // 1) Verificar autenticación y rol admin
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Solo los administradores pueden renovar reservas" },
      { status: 403 }
    );
  }

  // 2) Obtener la reserva original
  const admin = createSupabaseAdminClient();
  const { data: original, error: fetchErr } = await admin
    .from("reservations")
    .select("id, user_id, created_by, court_id, date, hour, price_cop, status")
    .eq("id", reservationId)
    .maybeSingle();

  if (fetchErr || !original) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  if (original.status === "cancelled") {
    return NextResponse.json(
      { error: "No se puede renovar una reserva cancelada" },
      { status: 400 }
    );
  }

  // 3) Calcular la fecha de la próxima semana
  const originalDate = new Date(`${original.date}T12:00:00`); // mediodía para evitar DST
  originalDate.setDate(originalDate.getDate() + 7);

  const nextYear = originalDate.getFullYear();
  const nextMonth = String(originalDate.getMonth() + 1).padStart(2, "0");
  const nextDay = String(originalDate.getDate()).padStart(2, "0");
  const nextDate = `${nextYear}-${nextMonth}-${nextDay}`;

  // 4) Verificar que el slot no esté ocupado
  const { data: conflict } = await admin
    .from("reservations")
    .select("id")
    .eq("court_id", original.court_id)
    .eq("date", nextDate)
    .eq("hour", original.hour)
    .in("status", ["active", "pending_payment"])
    .maybeSingle();

  if (conflict) {
    return NextResponse.json(
      {
        error: `El horario ${String(original.hour).padStart(2, "0")}:00 de la Cancha ${original.court_id} ya está ocupado el ${nextDate}`,
      },
      { status: 409 }
    );
  }

  // 5) Obtener precio actualizado para esa cancha y hora
  const { data: pricingRules } = await admin
    .from("pricing_rules")
    .select("start_hour, end_hour, price_cop")
    .eq("court_id", original.court_id)
    .eq("active", true);

  let priceCop = original.price_cop; // fallback al precio original
  if (pricingRules && pricingRules.length > 0) {
    const matched = pricingRules.find(
      (r) => original.hour >= r.start_hour && original.hour <= r.end_hour
    );
    if (matched) priceCop = matched.price_cop;
  }

  // 6) Crear la nueva reserva
  const insertPayload = {
    user_id: original.user_id,
    created_by: original.created_by,
    court_id: original.court_id,
    date: nextDate,
    hour: original.hour,
    price_cop: priceCop,
    status: "active",
    confirmed: false,
    deposit_paid: false,
  };

  const { data: newReservation, error: insertErr } = await admin
    .from("reservations")
    .insert(insertPayload)
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    reservation: newReservation,
    message: `Reserva renovada para el ${nextDate} a las ${String(original.hour).padStart(2, "0")}:00`,
  });
}
