"use client";

import { useEffect, useMemo, useState } from "react";
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
  // Generate 7 days window: 3 before anchor, anchor, 3 after
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

  // Date picker state
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

  const weekDays = useMemo(() => getWeekDays(anchorDate), [anchorDate]);
  const selectedDateStr = toDateStr(selectedDate);

  async function load() {
    setIsLoading(true);
    setError(null);

    const query = supabase
      .from("reservations")
      .select(
        "id, user_id, court_id, date, hour, price_cop, created_by, status, confirmed, confirmed_at, attended, attended_at, deposit_paid, deposit_cop, deposit_status",
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
  }

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

  // Filtered rows for selected date
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

  // Today in YYYY-MM-DD
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
    <div>
      {/* Search Bar & Filters */}
      <div className="mb-stack-lg bg-white p-4 rounded-xl border border-outline-variant/30 shadow-soft flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-grow w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" data-icon="search">search</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary outline-none text-body-md text-on-surface"
            placeholder="Buscar cliente por nombre, teléfono o ID..."
            type="text"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-outline-variant/40 rounded-lg hover:bg-surface-container-low transition-colors text-label-md font-bold text-on-surface whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-body-md" data-icon="filter_list">filter_list</span>
            Filtros
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-white rounded-lg hover:brightness-110 transition-all text-label-md font-bold whitespace-nowrap shadow-md shadow-secondary/20"
          >
            <span className="material-symbols-outlined text-body-md" data-icon="add">add</span>
            Nueva Reserva
          </button>
        </div>
      </div>

      {/* Header Section */}
      <div className="mb-stack-lg flex flex-col lg:flex-row justify-between items-start lg:items-end gap-gutter">
        <div>
          <h2 className="text-display font-display text-on-background mb-2 tracking-tight">Panel de administración</h2>
          <p className="text-body-lg font-body-lg text-on-surface-variant max-w-2xl">Gestión de reservas, precios, usuarios, productos y caja.</p>
        </div>
        {/* Summary Card */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-outline-variant/30 shadow-soft">
          <div className="flex flex-col">
            <span className="text-label-sm font-label-sm text-outline uppercase tracking-wider">Resumen total</span>
            <p className="text-headline-md font-headline-md text-on-surface">
              <span className="font-bold text-secondary">{activeRows.length}</span> activas{" "}
              <span className="mx-1 opacity-30">•</span>{" "}
              <span className="text-on-tertiary-container">{formatCOP(totalValue)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="bg-error text-white h-12 px-8 rounded-lg font-bold text-label-md hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-error/20"
          >
            Recargar
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-error/30 bg-error-container p-3 text-sm text-on-error-container font-semibold">
          {error}
        </div>
      )}

      {/* Reservations Control Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-gutter mb-stack-lg border-b border-outline-variant/20 pb-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h3 className="text-headline-lg font-headline-lg text-on-background">Calendario de Reservas</h3>
            <div className="flex items-center gap-2 bg-surface-container-high px-3 py-1 rounded-full">
              <input
                className="rounded border-outline-variant text-secondary focus:ring-secondary"
                id="canceled"
                type="checkbox"
                checked={showCancelled}
                onChange={(e) => setShowCancelled(e.target.checked)}
              />
              <label className="text-label-md font-label-md text-on-surface cursor-pointer" htmlFor="canceled">
                Ver canceladas
              </label>
            </div>
          </div>
          <p className="text-body-md font-body-md text-on-surface-variant">Consulta la disponibilidad y gestiona las reservas activas.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-2 border border-outline-variant/40 hover:bg-surface-container-high rounded-lg transition-colors flex items-center justify-center"
          >
            <span className="material-symbols-outlined" data-icon="calendar_month">calendar_month</span>
          </button>
          <div className="flex items-center bg-white border border-outline-variant/40 rounded-lg overflow-hidden">
            <button type="button" className="px-3 py-2 hover:bg-surface-container-low transition-colors border-r border-outline-variant/40 text-label-md">Día</button>
            <button type="button" className="px-3 py-2 bg-secondary text-white font-bold text-label-md">Semana</button>
            <button type="button" className="px-3 py-2 hover:bg-surface-container-low transition-colors border-l border-outline-variant/40 text-label-md">Mes</button>
          </div>
        </div>
      </div>

      {/* Horizontal Date Picker */}
      <div className="mb-stack-lg">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-label-md font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
            <span className="material-symbols-outlined text-body-md" data-icon="today">today</span>
            Seleccionar fecha
          </h4>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevWeek}
                className="p-1.5 hover:bg-surface-container-high rounded-full transition-colors border border-outline-variant/20"
              >
                <span className="material-symbols-outlined text-body-md" data-icon="chevron_left">chevron_left</span>
              </button>
              <span className="text-label-md font-bold text-on-surface min-w-[120px] text-center">
                {MONTHS_ES[anchorDate.getMonth()]} {anchorDate.getFullYear()}
              </span>
              <button
                type="button"
                onClick={nextWeek}
                className="p-1.5 hover:bg-surface-container-high rounded-full transition-colors border border-outline-variant/20"
              >
                <span className="material-symbols-outlined text-body-md" data-icon="chevron_right">chevron_right</span>
              </button>
            </div>
            <button type="button" onClick={goToday} className="text-secondary text-label-md font-bold hover:underline">
              Ir a hoy
            </button>
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar">
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
                className={`shrink-0 w-20 h-24 rounded-xl flex flex-col items-center justify-center gap-1 relative transition-all
                  ${isSelected
                    ? "border-2 border-secondary bg-secondary-container/10 shadow-md shadow-secondary/10"
                    : "border border-outline-variant/30 bg-white hover:border-secondary group"
                  }`}
              >
                {isToday && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-secondary text-white text-[9px] px-2 py-0.5 rounded-full font-bold uppercase">
                    Hoy
                  </div>
                )}
                <span className={`text-label-sm uppercase font-bold ${isSelected ? "text-secondary" : "text-outline group-hover:text-secondary"}`}>
                  {DAYS_ES[day.getDay()]}
                </span>
                <span className={`text-headline-md font-bold ${isSelected ? "text-secondary" : "text-on-surface group-hover:text-secondary"}`}>
                  {day.getDate()}
                </span>
                {dayReservations > 0 && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isSelected ? "bg-secondary text-white" : "bg-surface-container-high text-outline"}`}>
                    {dayReservations}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scheduling Grid */}
      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <FiLoader className="animate-spin text-3xl text-secondary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
          {/* Cancha 1 */}
          <CourtColumn
            courtId={1}
            rows={court1Rows}
            profiles={profiles}
            onUpdate={updateReservation}
            onDeleteRequest={setReservationToDelete}
          />
          {/* Cancha 2 */}
          <CourtColumn
            courtId={2}
            rows={court2Rows}
            profiles={profiles}
            onUpdate={updateReservation}
            onDeleteRequest={setReservationToDelete}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {reservationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 text-error mb-4">
              <div className="bg-error-container p-2 rounded-full">
                <FiTrash2 className="text-xl text-error" />
              </div>
              <h3 className="text-lg font-black tracking-tight text-on-surface">Eliminar Reserva</h3>
            </div>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              ¿Estás seguro de que deseas eliminar esta reserva permanentemente? Esta acción{" "}
              <strong className="font-semibold text-on-surface">no se puede deshacer</strong> y los datos
              se perderán de la base de datos.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setReservationToDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => confirmDelete(reservationToDelete)}
                className="px-4 py-2 text-sm font-semibold text-white bg-error hover:brightness-110 rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
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

// ─── Court Column Component ───────────────────────────────────────────────────

function CourtColumn({
  courtId,
  rows,
  profiles,
  onUpdate,
  onDeleteRequest,
}: {
  courtId: number;
  rows: ReservationRow[];
  profiles: Record<string, ProfileRow>;
  onUpdate: (id: string, patch: Partial<ReservationRow>) => void;
  onDeleteRequest: (id: string) => void;
}) {
  const borderColor = courtId === 1 ? "border-secondary" : "border-primary";
  const iconColor = courtId === 1 ? "text-secondary" : "text-primary";
  const badgeColor = courtId === 1 ? "text-secondary border-secondary/20" : "text-outline-variant border-outline-variant/20";

  return (
    <div className="space-y-stack-md">
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 bg-surface-container rounded-t-xl border-b-2 ${borderColor} shadow-sm`}>
        <span className={`material-symbols-outlined ${iconColor}`} data-icon="sports_soccer">sports_soccer</span>
        <h4 className="text-headline-md font-bold text-on-surface">Cancha {courtId}</h4>
        <span className={`ml-auto text-label-sm bg-white/60 px-3 py-1 rounded-full font-bold border ${badgeColor}`}>
          {rows.length} {rows.length === 1 ? "Reserva" : "Reservas"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="border-2 border-dashed border-outline-variant/20 rounded-xl p-8 flex flex-col items-center justify-center bg-white/40 min-h-[200px] text-center">
          <div className="bg-surface-container-high w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-4xl text-outline-variant/50" data-icon="event_available">event_available</span>
          </div>
          <p className="text-on-surface font-bold text-body-lg">Sin reservas para este día</p>
          <p className="text-on-surface-variant text-label-sm max-w-[200px] mt-1">
            Cancha {courtId} está libre en esta fecha.
          </p>
        </div>
      ) : (
        rows.map((r) => (
          <ReservationCard
            key={r.id}
            row={r}
            profile={profiles[r.user_id] ?? null}
            onUpdate={onUpdate}
            onDeleteRequest={onDeleteRequest}
          />
        ))
      )}
    </div>
  );
}

// ─── Reservation Card Component ───────────────────────────────────────────────

function formatCOPLocal(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function ReservationCard({
  row: r,
  profile: p,
  onUpdate,
  onDeleteRequest,
}: {
  row: ReservationRow;
  profile: ProfileRow | null;
  onUpdate: (id: string, patch: Partial<ReservationRow>) => void;
  onDeleteRequest: (id: string) => void;
}) {
  const phone = p?.phone ?? null;
  const customer = p?.username ?? r.created_by;

  const whatsappUrl = phone
    ? createWhatsAppUrl({
        phone,
        text: `Hola ${customer}. Te contactamos sobre tu reserva: Cancha ${r.court_id}, ${r.date} a las ${String(r.hour).padStart(2, "0")}:00. Valor: ${formatCOPLocal(r.price_cop)}.`,
      })
    : null;

  const isCancelled = r.status === "cancelled";
  const isPendingPayment = r.status === "pending_payment";
  const isConfirmed = Boolean(r.confirmed);
  const isAttended = Boolean(r.attended);
  const depositPaid = Boolean(r.deposit_paid);
  const depositValue = r.deposit_cop ?? 0;
  const pending = r.price_cop - depositValue;

  return (
    <div className={`bg-white rounded-xl border border-outline-variant/50 p-4 shadow-soft hover:shadow-md transition-all group relative ${isCancelled ? "opacity-70" : ""}`}>
      {/* Drag handle */}
      <div className="drag-handle absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center text-outline-variant hover:text-secondary transition-colors border-r border-outline-variant/10 rounded-l-xl">
        <span className="material-symbols-outlined text-body-md" data-icon="drag_indicator">drag_indicator</span>
      </div>

      <div className="pl-6">
        {/* Top: time + client + date */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className="bg-surface-container-high p-2 rounded-lg border border-outline-variant/20">
              <span className="text-headline-md font-bold text-on-background">
                {String(r.hour).padStart(2, "0")}:00
              </span>
            </div>
            <div>
              <h5 className="text-body-md font-bold text-on-surface group-hover:text-secondary transition-colors">
                {customer}
              </h5>
              {phone ? (
                <p className="text-label-sm text-outline flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]" data-icon="phone">phone</span>
                  {phone}
                </p>
              ) : (
                <p className="text-label-sm text-amber-500 italic">Sin teléfono</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-label-sm text-outline-variant">ID: #{r.id.slice(0, 6).toUpperCase()}</p>
            <p className="text-label-sm text-outline-variant font-medium">{r.date}</p>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border
            ${isCancelled
              ? "bg-error-container/30 text-on-error-container border-error/20"
              : isPendingPayment
              ? "bg-amber-100 text-amber-800 border-amber-200"
              : "bg-on-tertiary-container/10 text-on-tertiary-container border-on-tertiary-container/20"
            }`}>
            {isCancelled ? "Cancelada" : isPendingPayment ? "Pendiente Pago" : "Activa"}
          </span>
          {isConfirmed && (
            <span className="px-2 py-0.5 bg-secondary-container/10 text-secondary rounded text-[10px] font-bold uppercase tracking-wider border border-secondary/20">
              Confirmada
            </span>
          )}
          {isAttended && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold uppercase tracking-wider border border-purple-200">
              Asistió
            </span>
          )}
          {depositPaid && (
            <span className="px-2 py-0.5 bg-on-tertiary-container/10 text-on-tertiary-container rounded text-[10px] font-bold uppercase tracking-wider border border-on-tertiary-container/20">
              Abono registrado
            </span>
          )}
        </div>

        {/* Payment Info */}
        <div className="bg-surface-container-low/50 rounded-lg p-3 border border-outline-variant/20 mb-4 grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] uppercase font-bold text-outline tracking-tight">Total</p>
            <p className="text-body-md font-bold text-on-surface">{formatCOPLocal(r.price_cop)}</p>
          </div>
          <div className="border-x border-outline-variant/20 px-2">
            <p className="text-[10px] uppercase font-bold text-on-tertiary-container tracking-tight">Pagado</p>
            <p className="text-body-md font-bold text-on-tertiary-container">{formatCOPLocal(depositValue)}</p>
          </div>
          <div className="pl-2">
            <p className="text-[10px] uppercase font-bold text-error tracking-tight">Pendiente</p>
            <p className="text-body-md font-bold text-error">{formatCOPLocal(Math.max(0, pending))}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          {/* Confirm / Attended */}
          {!isCancelled && !isConfirmed && (
            <button
              type="button"
              onClick={() => onUpdate(r.id, { confirmed: true, confirmed_at: new Date().toISOString() })}
              className="flex items-center justify-center gap-1 py-2 bg-on-tertiary-container text-white rounded-lg font-bold text-label-sm hover:brightness-110 transition-all"
            >
              <span className="material-symbols-outlined text-sm" data-icon="check_circle">check_circle</span>
              Ok
            </button>
          )}
          {!isCancelled && isConfirmed && !isAttended && (
            <button
              type="button"
              onClick={() => onUpdate(r.id, { attended: true, attended_at: new Date().toISOString() })}
              className="flex items-center justify-center gap-1 py-2 bg-secondary text-white rounded-lg font-bold text-label-sm hover:brightness-110 transition-all"
            >
              <span className="material-symbols-outlined text-sm" data-icon="check_circle">check_circle</span>
              Asistió
            </button>
          )}
          {(isCancelled || isAttended) && (
            <div className="col-span-1" />
          )}

          {/* Chat WhatsApp */}
          <a
            href={whatsappUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => { if (!whatsappUrl) e.preventDefault(); }}
            className={`flex items-center justify-center gap-1 py-2 border rounded-lg font-bold text-label-sm transition-colors
              ${whatsappUrl
                ? "border-on-tertiary-container text-on-tertiary-container hover:bg-on-tertiary-container/5"
                : "border-outline-variant text-outline-variant cursor-not-allowed opacity-50"
              }`}
          >
            <span className="material-symbols-outlined text-sm" data-icon="forum">forum</span>
            Chat
          </a>

          {/* Cancel */}
          {!isCancelled ? (
            <button
              type="button"
              onClick={() => onUpdate(r.id, { status: "cancelled" })}
              className="flex items-center justify-center py-2 border border-outline-variant text-on-surface-variant rounded-lg font-bold text-label-sm hover:bg-surface-container-high transition-colors"
            >
              Cerrar
            </button>
          ) : (
            <div className="col-span-1" />
          )}
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDeleteRequest(r.id)}
          className="mt-3 w-full text-center text-error text-[10px] font-bold hover:underline py-1 flex items-center justify-center gap-1 opacity-50 hover:opacity-100 transition-opacity"
        >
          <span className="material-symbols-outlined text-sm" data-icon="delete">delete</span>
          Eliminar definitivamente
        </button>
      </div>
    </div>
  );
}
