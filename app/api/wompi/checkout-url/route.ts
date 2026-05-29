import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createIntegritySignature, getWompiCheckoutBaseUrl, getWompiPublicKey, getWompiIntegritySecret } from "../../../../lib/wompi";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const reservationId = searchParams.get("reservationId");

  if (!reservationId) {
    return NextResponse.json({ error: "reservationId es requerido" }, { status: 400 });
  }

  const publicKey = getWompiPublicKey();
  const integritySecret = getWompiIntegritySecret();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!publicKey || !integritySecret || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "Falta configurar variables de entorno en el servidor (Llaves de Wompi o SUPABASE_SERVICE_ROLE_KEY). Por favor verifica tu archivo .env.local.",
      },
      { status: 500 },
    );
  }

  // Limpiar reservas pending_payment expiradas (más de 15 minutos)
  const admin = createSupabaseAdminClient();
  await admin
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("status", "pending_payment")
    .lt("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());

  // Usuario logueado (para validar que la reserva es suya)
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: reservation, error: rErr } = await supabase
    .from("reservations")
    .select("id, user_id, court_id, date, hour, price_cop, deposit_paid")
    .eq("id", reservationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (rErr || !reservation) {
    console.error("DEBUG: Reserva no encontrada", { reservationId, userId: user.id, rErr, reservation });
    return NextResponse.json(
      { 
        error: rErr?.message ?? "Reserva no encontrada", 
        debug: { reservationId, userId: user.id, found: !!reservation } 
      },
      { status: 404 },
    );
  }

  if (reservation.deposit_paid) {
    return NextResponse.json(
      { error: "Esta reserva ya tiene el anticipo pagado." },
      { status: 400 },
    );
  }

  // Settings (porcentaje) se leen con service role (RLS admin-only)
  const { data: settings, error: sErr } = await admin
    .from("payment_settings")
    .select("deposit_percent")
    .eq("id", 1)
    .maybeSingle();

  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  const depositPercent = settings?.deposit_percent ?? 30;
  const depositCOP = Math.max(
    0,
    Math.round((reservation.price_cop * depositPercent) / 100),
  );
  const amountInCents = depositCOP * 100;
  const reference = `DEP-${reservation.id}-${Date.now()}`;

  const signature = createIntegritySignature({
    reference,
    amountInCents,
    currency: "COP",
    integritySecret,
  });

  const redirectUrl = `${process.env.NEXT_PUBLIC_BASE_URL || origin}/pago/resultado?reservationId=${encodeURIComponent(
    reservation.id,
  )}&reference=${encodeURIComponent(reference)}`;

  // Guardar intento de pago + snapshot del anticipo en la reserva
  // (server role para poder actualizar aunque el usuario no tenga policy update)
  const [{ error: pErr }, { error: uErr }] = await Promise.all([
    admin.from("reservation_payments").insert({
      reservation_id: reservation.id,
      reference,
      amount_cop: depositCOP,
      amount_in_cents: amountInCents,
      status: "PENDING",
    }),
    admin
      .from("reservations")
      .update({
        deposit_percent: depositPercent,
        deposit_cop: depositCOP,
        deposit_status: "PENDING",
        deposit_payment_reference: reference,
      })
      .eq("id", reservation.id),
  ]);

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }
  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  // Construir URL manualmente para Wompi Checkout
  const baseUrl = getWompiCheckoutBaseUrl();
  
  const queryParams = [
    `public-key=${publicKey}`,
    `currency=COP`,
    `amount-in-cents=${amountInCents}`,
    `reference=${reference}`,
    `signature:integrity=${signature}`,
    `redirect-url=${encodeURIComponent(redirectUrl)}`,
  ];

  const url = `${baseUrl}?${queryParams.join("&")}`;

  // Debug: Log para verificar la construcción de la URL
  console.log("=== WOMPI CHECKOUT DEBUG ===");
  console.log("Reference:", reference);
  console.log("Amount in cents:", amountInCents);
  console.log("Deposit COP:", depositCOP);
  console.log("Signature:", signature);
  console.log("Full URL:", url);
  console.log("===========================");

  return NextResponse.json({
    url,
    depositPercent,
    depositCOP,
  });
}

