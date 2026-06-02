import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatICalDate(dateStr: string, hour: number): string {
  const [y, m, d] = dateStr.split("-");
  const hh = String(hour).padStart(2, "0");
  return `${y}${m}${d}T${hh}0000`;
}

function formatICalEndDate(dateStr: string, hour: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const endHour = hour + 1;
  if (endHour === 24) {
    const dObj = new Date(y, m - 1, d + 1);
    const ny = dObj.getFullYear();
    const nm = String(dObj.getMonth() + 1).padStart(2, "0");
    const nd = String(dObj.getDate()).padStart(2, "0");
    return `${ny}${nm}${nd}T000000`;
  }
  const hh = String(endHour).padStart(2, "0");
  const sm = String(m).padStart(2, "0");
  const sd = String(d).padStart(2, "0");
  return `${y}${sm}${sd}T${hh}0000`;
}

// Para prevenir que cualquiera descargue el feed sin autorización
const SECURE_TOKEN = "panamericana_calendar_secret";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (token !== SECURE_TOKEN) {
    return new Response("No autorizado", { status: 401 });
  }

  try {
    const admin = createSupabaseAdminClient();

    // 1) Obtener todas las reservas activas (no canceladas)
    const { data: reservations, error: resErr } = await admin
      .from("reservations")
      .select("id, court_id, date, hour, price_cop, status, confirmed, deposit_paid, deposit_cop, deposit_payment_method, balance_payment_method, user_id, created_by")
      .eq("status", "active")
      .order("date", { ascending: true })
      .order("hour", { ascending: true });

    if (resErr) {
      return new Response(`Error cargando reservas: ${resErr.message}`, { status: 500 });
    }

    // 2) Obtener todos los perfiles de usuario para mapear nombres y teléfonos
    const userIds = Array.from(new Set((reservations ?? []).map((r) => r.user_id)));
    let profilesMap: Record<string, { username: string; phone: string }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, username, phone")
        .in("id", userIds);

      (profiles ?? []).forEach((p) => {
        profilesMap[p.id] = {
          username: p.username ?? "Usuario",
          phone: p.phone ?? "Sin teléfono",
        };
      });
    }

    // 3) Generar el string de iCalendar (.ics)
    let ical = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Sinteticas Panamericana//Calendar Feed//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Reservas Panamericana",
      "X-WR-TIMEZONE:America/Bogota",
      "X-WR-CALDESC:Feed de reservas de canchas en tiempo real",
    ];

    const nowStr = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    for (const r of (reservations ?? [])) {
      const profile = profilesMap[r.user_id] ?? { username: r.created_by, phone: "—" };
      const customer = profile.username;
      
      const start = formatICalDate(r.date, r.hour);
      const end = formatICalEndDate(r.date, r.hour);

      const statusStr = r.confirmed ? "Confirmado" : "Activa (Falta abono)";
      const abonoStr = r.deposit_paid 
        ? `Recibido (${formatCOP(r.deposit_cop ?? 0)} via ${r.deposit_payment_method ?? '—'})`
        : "Pendiente";
      const totalStr = formatCOP(r.price_cop);
      const remainderStr = formatCOP(r.price_cop - (r.deposit_cop ?? 0));

      const desc = [
        `Cliente: ${customer}`,
        `Telefono: ${profile.phone}`,
        `Cancha: ${r.court_id}`,
        `Total: ${totalStr}`,
        `Abono: ${abonoStr}`,
        `Faltante a pagar: ${remainderStr}`,
        `Estado: ${statusStr}`,
        `ID Reserva: ${r.id.slice(0, 8).toUpperCase()}`,
      ].join("\\n"); // escapado para iCal

      ical.push(
        "BEGIN:VEVENT",
        `UID:${r.id}`,
        `DTSTAMP:${nowStr}`,
        `DTSTART;TZID=America/Bogota:${start}`,
        `DTEND;TZID=America/Bogota:${end}`,
        `SUMMARY:Cancha ${r.court_id} - ${customer}`,
        `DESCRIPTION:${desc}`,
        "END:VEVENT"
      );
    }

    ical.push("END:VCALENDAR");

    const responseText = ical.join("\r\n");

    return new Response(responseText, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "attachment; filename=reservas.ics",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    return new Response(`Error interno: ${error?.message || error}`, { status: 500 });
  }
}
