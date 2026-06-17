"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { FiLoader, FiTrash2 } from "react-icons/fi";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { createWhatsAppUrl } from "../../../lib/whatsapp";
import { deleteReservationAdminAction } from "./actions";

type ReservationRow = {
  id: string;
  user_id: string;
  court_id: number;
  date: string;
  hour: number;
  price_cop: number;
  created_by: string;
  status: "active" | "cancelled" | string;
  confirmed?: boolean | null;
  confirmed_at?: string | null;
  attended?: boolean | null;
  attended_at?: string | null;
  deposit_paid?: boolean | null;
  deposit_cop?: number | null;
  deposit_status?: string | null;
  deposit_payment_method?: string | null;
  balance_payment_method?: string | null;
  deposit_percent?: number | null;
};

type ProfileRow = { id: string; username: string | null; phone: string | null };

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function getWeekDays(anchor: Date) {
  return Array.from({ length: 9 }, (_, i) => {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - 4 + i);
    return d;
  });
}

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AdminReservasPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<ReservationRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [showCancelled, setShowCancelled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reservationToDelete, setReservationToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [anchorDate, setAnchorDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  // Fecha pendiente de navegación tras una renovación
  const [pendingNavDate, setPendingNavDate] = useState<string | null>(null);

  const weekDays = useMemo(() => getWeekDays(anchorDate), [anchorDate]);
  const selectedDateStr = toDateStr(selectedDate);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const query = supabase
      .from("reservations")
      .select(
        "id, user_id, court_id, date, hour, price_cop, created_by, status, confirmed, confirmed_at, attended, attended_at, deposit_paid, deposit_cop, deposit_status, deposit_payment_method, balance_payment_method, deposit_percent",
      )
      .order("date", { ascending: true })
      .order("hour", { ascending: true });

    const { data, error: qErr } = showCancelled
      ? await query
      : await query.in("status", ["active", "pending_payment"]);

    if (qErr) {
      setError(qErr.message);
      setRows([]);
      setProfiles({});
      setIsLoading(false);
      return;
    }

    const list = (data ?? []) as ReservationRow[];
    setRows(list);

    const userIds = Array.from(new Set(list.map((r) => r.user_id)));
    if (userIds.length > 0) {
      const { data: pData } = await supabase
        .from("profiles")
        .select("id, username, phone")
        .in("id", userIds);

      const map: Record<string, ProfileRow> = {};
      (pData ?? []).forEach((p) => {
        map[p.id] = p as ProfileRow;
      });
      setProfiles(map);
    } else {
      setProfiles({});
    }

    setIsLoading(false);
  }, [supabase, showCancelled]);

  // Cuando hay una fecha pendiente de navegación, navegar después de que los datos cargaron
  useEffect(() => {
    if (pendingNavDate && !isLoading) {
      const d = new Date(pendingNavDate + "T12:00:00");
      setAnchorDate(d);
      setSelectedDate(d);
      setPendingNavDate(null);
    }
  }, [pendingNavDate, isLoading]);

  const navigateAndReload = useCallback((newDate: string) => {
    setPendingNavDate(newDate);
    load();
  }, [load]);

  const handleRenewedFromPage = useCallback((newDate: string, errorMsg?: string) => {
    if (errorMsg) {
      setError(errorMsg);
      return;
    }
    if (newDate) {
      navigateAndReload(newDate);
    } else {
      load();
    }
  }, [navigateAndReload, load]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCancelled]);

  async function updateReservation(id: string, patch: Partial<ReservationRow>) {
    const { error } = await supabase.from("reservations").update(patch).eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function confirmDelete(id: string) {
    setIsDeleting(true);
    setError(null);
    const result = await deleteReservationAdminAction(id);
    setIsDeleting(false);
    if (!result.success) {
      setError(result.error || "No se pudo eliminar la reserva.");
      setReservationToDelete(null);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    setReservationToDelete(null);
  }

  const filteredRows = useMemo(() => {
    let r = rows.filter((row) => row.date === selectedDateStr);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter((row) => {
        const p = profiles[row.user_id];
        return (
          p?.username?.toLowerCase().includes(q) ||
          p?.phone?.includes(q) ||
          row.id.toLowerCase().includes(q) ||
          row.created_by?.toLowerCase().includes(q)
        );
      });
    }
    return r;
  }, [rows, selectedDateStr, searchQuery, profiles]);

  const court1Rows = useMemo(() => filteredRows.filter((r) => r.court_id === 1), [filteredRows]);
  const court2Rows = useMemo(() => filteredRows.filter((r) => r.court_id === 2), [filteredRows]);

  const activeRows = rows.filter((r) => r.status === "active");
  const totalValue = useMemo(
    () => activeRows.reduce((acc, r) => acc + r.price_cop, 0),
    [activeRows],
  );

  const todayStr = toDateStr(new Date());

  const prevWeek = () => {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - 7);
    setAnchorDate(d);
  };
  const nextWeek = () => {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() + 7);
    setAnchorDate(d);
  };
  const goToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setAnchorDate(d);
    setSelectedDate(d);
  };

  return (
    <div className="space-y-6">
      {/* Header + Summary */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-black tracking-tight text-on-surface">Calendario de Reservas</h2>
          <p className="text-sm text-on-surface-variant mt-1">Gestiona las reservas por fecha y cancha.</p>
        </div>

        {/* Summary + Actions Row */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl border border-outline-variant/30 shadow-sm">
            <div>
              <span className="text-[10px] uppercase font-bold text-outline tracking-wider">Resumen</span>
              <p className="text-sm font-bold text-on-surface">
                <span className="text-primary">{activeRows.length}</span> activas • {formatCOP(totalValue)}
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              className="ml-auto bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
            >
              Recargar
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant bg-white px-3 py-2 rounded-lg border border-outline-variant/30 cursor-pointer">
              <input
                type="checkbox"
                checked={showCancelled}
                onChange={(e) => setShowCancelled(e.target.checked)}
                className="rounded border-outline-variant text-primary focus:ring-primary"
              />
              Ver canceladas
            </label>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-xl">search</span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-outline-variant/40 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
          placeholder="Buscar cliente por nombre, teléfono o ID..."
          type="text"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-semibold">
          {error}
        </div>
      )}

      {/* Date Picker */}
      <div className="bg-white rounded-xl border border-outline-variant/30 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={goToday} className="text-primary text-xs font-bold hover:underline">
            Hoy
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevWeek}
              className="p-1.5 hover:bg-surface-container-high rounded-full transition-colors"
            >
              <span className="material-symbols-outlined text-lg">chevron_left</span>
            </button>
            <span className="text-sm font-bold text-on-surface min-w-[130px] text-center">
              {MONTHS_ES[anchorDate.getMonth()]} {anchorDate.getFullYear()}
            </span>
            <button
              type="button"
              onClick={nextWeek}
              className="p-1.5 hover:bg-surface-container-high rounded-full transition-colors"
            >
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
          {weekDays.map((day) => {
            const ds = toDateStr(day);
            const isToday = ds === todayStr;
            const isSelected = ds === selectedDateStr;
            const dayReservations = rows.filter((r) => r.date === ds && r.status === "active").length;
            return (
              <button
                key={ds}
                type="button"
                onClick={() => setSelectedDate(new Date(day))}
                className={`shrink-0 w-14 sm:w-16 py-3 rounded-xl flex flex-col items-center justify-center gap-0.5 relative transition-all
                  ${isSelected
                    ? "border-2 border-primary bg-primary/5 shadow-sm"
                    : "border border-outline-variant/30 bg-white hover:border-primary/50"
                  }`}
              >
                {isToday && (
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold">
                    HOY
                  </div>
                )}
                <span className={`text-[10px] uppercase font-bold ${isSelected ? "text-primary" : "text-outline"}`}>
                  {DAYS_ES[day.getDay()]}
                </span>
                <span className={`text-lg font-bold ${isSelected ? "text-primary" : "text-on-surface"}`}>
                  {day.getDate()}
                </span>
                {dayReservations > 0 && (
                  <span className={`text-[8px] font-bold px-1.5 rounded-full ${isSelected ? "bg-primary text-white" : "bg-surface-container-high text-outline"}`}>
                    {dayReservations}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reservations Grid */}
      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <FiLoader className="animate-spin text-3xl text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CourtColumn
            courtId={1}
            rows={court1Rows}
            profiles={profiles}
            onUpdate={updateReservation}
            onDeleteRequest={setReservationToDelete}
            onRenewed={handleRenewedFromPage}
          />
          <CourtColumn
            courtId={2}
            rows={court2Rows}
            profiles={profiles}
            onUpdate={updateReservation}
            onDeleteRequest={setReservationToDelete}
            onRenewed={handleRenewedFromPage}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {reservationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2.5 rounded-full">
                <FiTrash2 className="text-lg text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">Eliminar Reserva</h3>
                <p className="text-xs text-on-surface-variant">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant mb-5">
              ¿Estás seguro de que deseas eliminar esta reserva permanentemente?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setReservationToDelete(null)}
                className="px-4 py-2.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => confirmDelete(reservationToDelete)}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                {isDeleting ? <FiLoader className="animate-spin" /> : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Court Column ─────────────────────────────────────────────────────────────

function CourtColumn({
  courtId,
  rows,
  profiles,
  onUpdate,
  onDeleteRequest,
  onRenewed,
}: {
  courtId: number;
  rows: ReservationRow[];
  profiles: Record<string, ProfileRow>;
  onUpdate: (id: string, patch: Partial<ReservationRow>) => void;
  onDeleteRequest: (id: string) => void;
  onRenewed?: (newDate: string, error?: string) => void;
}) {
  const accentColor = courtId === 1 ? "border-primary" : "border-tertiary";
  const iconColor = courtId === 1 ? "text-primary" : "text-tertiary";

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-3 px-4 py-3 bg-white rounded-xl border-l-4 ${accentColor} shadow-sm`}>
        <span className={`material-symbols-outlined ${iconColor}`}>sports_soccer</span>
        <h4 className="text-base font-bold text-on-surface">Cancha {courtId}</h4>
        <span className="ml-auto text-xs bg-surface-container-high px-2.5 py-1 rounded-full font-bold text-on-surface-variant">
          {rows.length} {rows.length === 1 ? "reserva" : "reservas"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="border border-dashed border-outline-variant/30 rounded-xl p-6 flex flex-col items-center justify-center bg-white/50 text-center">
          <span className="material-symbols-outlined text-4xl text-outline-variant/40 mb-2">event_available</span>
          <p className="text-sm font-semibold text-on-surface-variant">Sin reservas</p>
          <p className="text-xs text-outline mt-0.5">Cancha {courtId} disponible</p>
        </div>
      ) : (
        rows.map((r) => (
          <ReservationCard
            key={r.id}
            row={r}
            profile={profiles[r.user_id] ?? null}
            onUpdate={onUpdate}
            onDeleteRequest={onDeleteRequest}
            onRenewed={onRenewed}
          />
        ))
      )}
    </div>
  );
}

// ─── Reservation Card ─────────────────────────────────────────────────────────

function ReservationCard({
  row: r,
  profile: p,
  onUpdate,
  onDeleteRequest,
  onRenewed,
}: {
  row: ReservationRow;
  profile: ProfileRow | null;
  onUpdate: (id: string, patch: Partial<ReservationRow>) => void;
  onDeleteRequest: (id: string) => void;
  onRenewed?: (newDate: string, error?: string) => void;
}) {
  const phone = p?.phone ?? null;
  const isPhysical = r.created_by?.includes("(Físico)");
  const customer = isPhysical ? r.created_by : (p?.username ?? r.created_by);
  const [expanded, setExpanded] = useState(false);
  const [payMethod, setPayMethod] = useState<string>("nequi");
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);
  const [renewSuccess, setRenewSuccess] = useState<string | null>(null);

  async function handleRenew() {
    setIsRenewing(true);
    setRenewError(null);
    setRenewSuccess(null);
    try {
      const res = await fetch("/api/reservations/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: r.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRenewError(data.error ?? "Error al renovar");
        onRenewed?.("", data.error ?? "Error al renovar");
      } else {
        setRenewSuccess(data.message ?? "Reserva renovada");
        onRenewed?.(data.reservation?.date ?? "", undefined);
      }
    } catch {
      setRenewError("Error de conexión");
    } finally {
      setIsRenewing(false);
    }
  }

  const isCancelled = r.status === "cancelled";
  const isPendingPayment = r.status === "pending_payment";
  const isConfirmed = Boolean(r.confirmed);
  const isAttended = Boolean(r.attended);
  const depositPaid = Boolean(r.deposit_paid);
  const depositValue = r.deposit_cop ?? 0;
  const pending = r.price_cop - depositValue;
  const depPercent = r.deposit_percent ?? 30;

  const abonoAmount = Math.round(r.price_cop * depPercent / 100);

  const whatsappUrl = phone
    ? createWhatsAppUrl({
        phone,
        text: !depositPaid
          ? `Hola ${customer}. Te contactamos de Sintéticas Panamericana sobre tu reserva: Cancha ${r.court_id}, el día ${r.date} a las ${String(r.hour).padStart(2, "0")}:00.
Valor Total: ${formatCOP(r.price_cop)}.
Para confirmar tu reserva, debes realizar un abono de: ${formatCOP(abonoAmount)} (${depPercent}%).
El saldo restante a pagar en taquilla es: ${formatCOP(r.price_cop - abonoAmount)}.
Medios de pago:
- Nequi: 318 602 5827
- Daviplata: 318 602 5827
- Ahorros Bancolombia: #551-000234-98
Por favor envía tu comprobante por este medio.`
          : `Hola ${customer}. Confirmamos tu reserva de la Cancha ${r.court_id} el día ${r.date} a las ${String(r.hour).padStart(2, "0")}:00.
Valor Total: ${formatCOP(r.price_cop)}.
Abono Recibido: ${formatCOP(r.deposit_cop ?? 0)} (${r.deposit_payment_method ?? 'Confirmado'}).
Saldo Restante a pagar en taquilla: ${formatCOP(r.price_cop - (r.deposit_cop ?? 0))}.
¡Te esperamos!`,
      })
    : null;

  return (
    <div className={`bg-white rounded-xl border border-outline-variant/30 shadow-sm transition-all ${isCancelled ? "opacity-60" : ""}`}>
      {/* Compact row - always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
      >
        {/* Time */}
        <span className="text-xs font-bold text-on-surface bg-surface-container px-2 py-1 rounded shrink-0">
          {String(r.hour).padStart(2, "0")}:00
        </span>

        {/* Client name */}
        <span className="text-xs font-semibold text-on-surface truncate flex-1 min-w-0">
          {customer}
        </span>

        {/* Status badge */}
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0
          ${isCancelled
            ? "bg-red-100 text-red-700"
            : isPendingPayment
            ? "bg-amber-100 text-amber-700"
            : isConfirmed
            ? "bg-blue-100 text-blue-700"
            : "bg-green-100 text-green-700"
          }`}>
          {isCancelled ? "Cancel." : isPendingPayment ? "Pend." : isConfirmed ? (isAttended ? "Asist." : "Conf.") : "Activa"}
        </span>

        {/* Amount */}
        <span className="text-xs font-bold text-on-surface shrink-0">
          {formatCOP(r.price_cop)}
        </span>

        {/* Chevron */}
        <span className={`material-symbols-outlined text-lg text-outline transition-transform ${expanded ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-outline-variant/20 pt-2 space-y-2">
          {/* Client info */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-outline">
              {phone ? (
                <>
                  <span className="material-symbols-outlined text-[12px]">phone</span>
                  {phone}
                </>
              ) : (
                <span className="text-amber-500 italic">Sin teléfono</span>
              )}
            </div>
            <span className="text-[10px] text-outline-variant">#{r.id.slice(0, 6).toUpperCase()}</span>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1">
            {isConfirmed && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold">Confirmada</span>}
            {isAttended && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-bold">Asistió</span>}
            {depositPaid && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[9px] font-bold">Abono</span>}
          </div>

          {/* Payment Method Selector (Nequi / Efectivo) */}
          {!isCancelled && pending > 0 && (
            <div className="flex items-center gap-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl p-2">
              <span className="font-bold text-zinc-700">Medio de Pago:</span>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="bg-white border border-outline-variant/40 rounded px-2 py-1 outline-none text-[11px] font-semibold text-zinc-800"
              >
                <option value="nequi">Nequi</option>
                <option value="daviplata">Daviplata</option>
                <option value="efectivo">Efectivo</option>
              </select>
            </div>
          )}

          {/* Payment */}
          <div className="bg-surface-container-low rounded-lg p-2 grid grid-cols-3 gap-1 text-center">
            <div>
              <p className="text-[8px] uppercase font-bold text-outline">Total</p>
              <p className="text-[11px] font-bold text-on-surface">{formatCOP(r.price_cop)}</p>
            </div>
            <div className="border-x border-outline-variant/20">
              <p className="text-[8px] uppercase font-bold text-green-600">Pagado</p>
              <p className="text-[11px] font-bold text-green-700">{formatCOP(depositValue)}</p>
              {depositPaid && r.deposit_payment_method && (
                <p className="text-[8px] text-zinc-500 font-semibold uppercase mt-0.5">({r.deposit_payment_method})</p>
              )}
            </div>
            <div>
              <p className="text-[8px] uppercase font-bold text-red-500">Pendiente</p>
              <p className="text-[11px] font-bold text-red-600">{formatCOP(Math.max(0, pending))}</p>
              {depositValue === r.price_cop && r.balance_payment_method && (
                <p className="text-[8px] text-zinc-500 font-semibold uppercase mt-0.5">({r.balance_payment_method})</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-1.5">
            {!isCancelled && !isConfirmed && (
              <button
                type="button"
                onClick={() => onUpdate(r.id, { confirmed: true, confirmed_at: new Date().toISOString() })}
                className="flex-1 min-w-[60px] flex items-center justify-center gap-1 py-1.5 bg-zinc-800 text-white rounded-lg text-[11px] font-bold hover:bg-zinc-700 transition-all"
              >
                Confirmar
              </button>
            )}
            {!isCancelled && !depositPaid && (
              <button
                type="button"
                onClick={() => onUpdate(r.id, { 
                  deposit_paid: true, 
                  deposit_cop: abonoAmount, 
                  deposit_payment_method: payMethod,
                  confirmed: true,
                  confirmed_at: new Date().toISOString()
                })}
                className="flex-1 min-w-[60px] flex items-center justify-center gap-1 py-1.5 bg-primary text-white rounded-lg text-[11px] font-bold hover:brightness-110 transition-all"
              >
                Abono recibido
              </button>
            )}
            {!isCancelled && depositPaid && pending > 0 && (
              <button
                type="button"
                onClick={() => onUpdate(r.id, { 
                  deposit_cop: r.price_cop, 
                  balance_payment_method: payMethod,
                  confirmed: true,
                  confirmed_at: new Date().toISOString()
                })}
                className="flex-1 min-w-[60px] flex items-center justify-center gap-1 py-1.5 bg-green-600 text-white rounded-lg text-[11px] font-bold hover:bg-green-700 transition-all"
              >
                Completar Pago
              </button>
            )}
            {!isCancelled && isConfirmed && !isAttended && (
              <button
                type="button"
                onClick={() => onUpdate(r.id, { attended: true, attended_at: new Date().toISOString() })}
                className="flex-1 min-w-[60px] flex items-center justify-center gap-1 py-1.5 bg-secondary text-white rounded-lg text-[11px] font-bold hover:brightness-110 transition-all"
              >
                Asistió
              </button>
            )}
            <a
              href={whatsappUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => { if (!whatsappUrl) e.preventDefault(); }}
              className={`flex-1 min-w-[60px] flex items-center justify-center gap-1 py-1.5 border rounded-lg text-[11px] font-bold transition-colors
                ${whatsappUrl
                  ? "border-green-600 text-green-700 hover:bg-green-50"
                  : "border-outline-variant text-outline-variant cursor-not-allowed opacity-50"
                }`}
            >
              WhatsApp
            </a>
            {!isCancelled && (
              <button
                type="button"
                onClick={() => onUpdate(r.id, { status: "cancelled" })}
                className="flex-1 min-w-[60px] flex items-center justify-center py-1.5 border border-outline-variant text-on-surface-variant rounded-lg text-[11px] font-bold hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>

          {/* Renovar semana siguiente */}
          {!isCancelled && (
            <div className="space-y-1">
              <button
                type="button"
                disabled={isRenewing}
                onClick={handleRenew}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-blue-400 text-blue-600 rounded-lg text-[11px] font-bold hover:bg-blue-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isRenewing ? (
                  <FiLoader className="animate-spin text-xs" />
                ) : (
                  <span className="material-symbols-outlined text-[14px]">event_repeat</span>
                )}
                {isRenewing ? "Renovando..." : "Renovar semana siguiente"}
              </button>
              {renewSuccess && (
                <p className="text-[10px] text-green-600 font-semibold text-center">{renewSuccess}</p>
              )}
              {renewError && (
                <p className="text-[10px] text-red-500 font-semibold text-center">{renewError}</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => onDeleteRequest(r.id)}
            className="w-full text-center text-red-400 text-[10px] font-bold hover:text-red-600 transition-colors"
          >
            Eliminar definitivamente
          </button>
        </div>
      )}
    </div>
  );
}
