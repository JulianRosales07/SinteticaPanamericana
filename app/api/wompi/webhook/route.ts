import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { sha256Hex, getWompiEventsSecret } from "../../../../lib/wompi";

function getByPath(obj: any, path: string) {
  // path ejemplo: "transaction.id"
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

export async function POST(request: Request) {
  const eventSecret = getWompiEventsSecret();
  if (!eventSecret) {
    return NextResponse.json(
      { error: "Faltan secretos de eventos Wompi (Prueba o Producción)" },
      { status: 500 },
    );
  }

  const checksumHeader =
    request.headers.get("x-event-checksum") ??
    request.headers.get("X-Event-Checksum");

  const body = await request.json();

  try {
    const signature = body?.signature;
    const properties: string[] = signature?.properties ?? [];
    const timestamp: number = body?.timestamp; // timestamp está en el root, no en signature

    if (!checksumHeader || !Array.isArray(properties) || !timestamp) {
      console.error("Webhook validation failed:", {
        hasChecksum: !!checksumHeader,
        hasProperties: Array.isArray(properties),
        hasTimestamp: !!timestamp,
        body
      });
      return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
    }

    // 1) concatenar valores de properties (en orden) desde body.data
    const values = properties
      .map((p) => {
        const v = getByPath(body?.data, p);
        return v == null ? "" : String(v);
      })
      .join("");

    // 2) + timestamp + secret
    const concatenated = `${values}${timestamp}${eventSecret}`;
    const expected = sha256Hex(concatenated);

    console.log("=== WEBHOOK SIGNATURE DEBUG ===");
    console.log("Properties:", properties);
    console.log("Values:", values);
    console.log("Timestamp:", timestamp);
    console.log("Concatenated:", concatenated);
    console.log("Expected checksum:", expected);
    console.log("Received checksum:", checksumHeader);
    console.log("Match:", expected.toLowerCase() === String(checksumHeader).toLowerCase());
    console.log("===============================");

    if (expected.toLowerCase() !== String(checksumHeader).toLowerCase()) {
      // Ignorar eventos no válidos
      return NextResponse.json({ error: "Checksum inválido" }, { status: 401 });
    }
  } catch (err) {
    console.error("Webhook validation error:", err);
    return NextResponse.json({ error: "No se pudo validar el evento" }, { status: 400 });
  }

  // Procesar evento
  const tx = body?.data?.transaction;
  const eventName = body?.event as string | undefined;

  if (eventName !== "transaction.updated" || !tx?.reference) {
    // Responder 200 para no reintentar, pero no hacemos nada
    return NextResponse.json({ ok: true });
  }

  const reference: string = tx.reference;
  const status: string = tx.status ?? "UNKNOWN";
  const txId: string | null = tx.id ?? null;

  const admin = createSupabaseAdminClient();

  // 1) Actualizar payment por reference
  const { data: payRow, error: payErr } = await admin
    .from("reservation_payments")
    .update({
      status,
      wompi_transaction_id: txId,
      wompi_event: body,
      updated_at: new Date().toISOString(),
    })
    .eq("reference", reference)
    .select("reservation_id")
    .maybeSingle();

  if (payErr) {
    // Igual respondemos 200 para evitar reintentos infinitos por errores internos,
    // pero esto debería revisarse en logs.
    return NextResponse.json({ ok: true, warning: payErr.message });
  }

  // 2) Actualizar reserva
  if (payRow?.reservation_id) {
    const patch: Record<string, any> = {
      deposit_status: status,
      wompi_transaction_id: txId,
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

  return NextResponse.json({ ok: true });
}
