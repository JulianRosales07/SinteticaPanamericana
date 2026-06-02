"use client";

import { useEffect, useMemo, useState } from "react";
import { FiLoader, FiCalendar, FiDollarSign, FiShoppingBag, FiLayers, FiRefreshCw, FiTrendingUp } from "react-icons/fi";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { Button } from "../../../components/Button";

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

// Helpers para fechas
function getTodayRange() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${day}`;
  return { start: dateStr, end: dateStr };
}

function getWeekRange() {
  const today = new Date();
  const first = today.getDate() - today.getDay(); // Domingo
  const last = first + 6; // Sábado

  const dFirst = new Date(today.setDate(first));
  const dLast = new Date(today.setDate(last));

  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  return { start: format(dFirst), end: format(dLast) };
}

function getMonthRange() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);

  const format = (d: Date) => {
    const yr = d.getFullYear();
    const mt = String(d.getMonth() + 1).padStart(2, "0");
    const dy = String(d.getDate()).padStart(2, "0");
    return `${yr}-${mt}-${dy}`;
  };

  return { start: format(firstDay), end: format(lastDay) };
}

export default function AdminReportesPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [filterType, setFilterType] = useState<"today" | "week" | "month" | "custom">("today");
  const [startDate, setStartDate] = useState(() => getTodayRange().start);
  const [endDate, setEndDate] = useState(() => getTodayRange().end);

  const [reservations, setReservations] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar datos
  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const { data: resData, error: resErr } = await supabase
        .from("reservations")
        .select("id, court_id, date, hour, price_cop, status, confirmed, deposit_paid, deposit_cop, deposit_payment_method, balance_payment_method, deposit_percent, user_id, created_by")
        .gte("date", startDate)
        .lte("date", endDate)
        .in("status", ["active", "pending_payment"]);

      if (resErr) throw resErr;

      // 2) Cargar ventas en el rango
      const startISO = `${startDate}T00:00:00`;
      const endISO = `${endDate}T23:59:59`;

      const { data: salesData, error: salesErr } = await supabase
        .from("sales")
        .select("id, sold_at, total_cop")
        .gte("sold_at", startISO)
        .lte("sold_at", endISO);

      if (salesErr) throw salesErr;

      setReservations(resData ?? []);
      setSales(salesData ?? []);

      // 3) Cargar nombres de perfiles
      const userIds = Array.from(new Set((resData ?? []).map((r) => r.user_id)));
      if (userIds.length > 0) {
        const { data: profData } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", userIds);

        const map: Record<string, string> = {};
        (profData ?? []).forEach((p) => {
          map[p.id] = p.username ?? "Usuario";
        });
        setProfiles(map);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Ocurrió un error al cargar los reportes.");
    } finally {
      setLoading(false);
    }
  }

  // Efecto para actualizar rango por filtro rápido
  useEffect(() => {
    if (filterType === "today") {
      const r = getTodayRange();
      setStartDate(r.start);
      setEndDate(r.end);
    } else if (filterType === "week") {
      const r = getWeekRange();
      setStartDate(r.start);
      setEndDate(r.end);
    } else if (filterType === "month") {
      const r = getMonthRange();
      setStartDate(r.start);
      setEndDate(r.end);
    }
  }, [filterType]);

  // Cargar datos al cambiar de fechas
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  // Cálculos financieros
  const financials = useMemo(() => {
    let totalReservas = 0;
    let totalBar = sales.reduce((acc, s) => acc + (s.total_cop ?? 0), 0);

    let nequi = 0;
    let daviplata = 0;
    let efectivo = 0;
    let otros = 0;

    for (const r of reservations) {
      if (r.deposit_paid) {
        const depVal = r.deposit_cop ?? 0;
        const totalVal = r.price_cop;

        if (depVal === totalVal) {
          // Totalmente pagado (abono + saldo)
          const depPct = r.deposit_percent ?? 30;
          const abono = Math.round(totalVal * depPct / 100);
          const saldo = totalVal - abono;

          totalReservas += totalVal;

          // Procesar abono
          const depMethod = (r.deposit_payment_method ?? "nequi").toLowerCase();
          if (depMethod === "nequi") nequi += abono;
          else if (depMethod === "daviplata") daviplata += abono;
          else if (depMethod === "efectivo") efectivo += abono;
          else otros += abono;

          // Procesar saldo
          const balMethod = (r.balance_payment_method ?? "nequi").toLowerCase();
          if (balMethod === "nequi") nequi += saldo;
          else if (balMethod === "daviplata") daviplata += saldo;
          else if (balMethod === "efectivo") efectivo += saldo;
          else otros += saldo;
        } else {
          // Únicamente abono pagado
          totalReservas += depVal;
          const depMethod = (r.deposit_payment_method ?? "nequi").toLowerCase();
          if (depMethod === "nequi") nequi += depVal;
          else if (depMethod === "daviplata") daviplata += depVal;
          else if (depMethod === "efectivo") efectivo += depVal;
          else otros += depVal;
        }
      }
    }

    return {
      totalReservas,
      totalBar,
      totalCombined: totalReservas + totalBar,
      nequi,
      daviplata,
      efectivo,
      otros,
    };
  }, [reservations, sales]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl lg:text-2xl font-black tracking-tight text-on-surface">Reportes Financieros</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Analiza los ingresos consolidados por canchas, bar y métodos de pago.
          </p>
        </div>
        <button
          onClick={loadData}
          className="self-start flex items-center gap-1.5 px-4 py-2.5 bg-white border border-outline-variant/30 rounded-xl text-xs font-bold hover:bg-surface-container transition-colors"
        >
          <FiRefreshCw className="text-sm" /> Recargar
        </button>
      </div>

      {/* Date Filters Row */}
      <div className="bg-white rounded-2xl border border-outline-variant/30 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFilterType("today")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterType === "today" ? "bg-primary text-white" : "hover:bg-zinc-100 text-zinc-600"
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => setFilterType("week")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterType === "week" ? "bg-primary text-white" : "hover:bg-zinc-100 text-zinc-600"
            }`}
          >
            Esta Semana
          </button>
          <button
            onClick={() => setFilterType("month")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterType === "month" ? "bg-primary text-white" : "hover:bg-zinc-100 text-zinc-600"
            }`}
          >
            Este Mes
          </button>
          <button
            onClick={() => setFilterType("custom")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterType === "custom" ? "bg-primary text-white" : "hover:bg-zinc-100 text-zinc-600"
            }`}
          >
            Rango Personalizado
          </button>
        </div>

        {filterType === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-zinc-400 text-xs">hasta</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        <div className="text-xs text-zinc-500 font-semibold">
          Período: <span className="text-zinc-800">{startDate}</span> al <span className="text-zinc-800">{endDate}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <FiLoader className="animate-spin text-3xl text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-violet-50 rounded-2xl p-5 border border-violet-100 shadow-xs">
              <div className="flex items-center gap-2 text-violet-700 mb-1">
                <FiDollarSign className="text-lg" />
                <span className="text-[10px] uppercase font-bold tracking-wider">Ingreso Total</span>
              </div>
              <p className="text-2xl font-black text-violet-800">{formatCOP(financials.totalCombined)}</p>
              <p className="text-[10px] text-violet-600/70 font-semibold mt-1">Canchas + Bar/Cafetería</p>
            </div>

            <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-700 mb-1">
                <FiTrendingUp className="text-lg" />
                <span className="text-[10px] uppercase font-bold tracking-wider">Ingreso Canchas</span>
              </div>
              <p className="text-2xl font-black text-emerald-800">{formatCOP(financials.totalReservas)}</p>
              <p className="text-[10px] text-emerald-600/70 font-semibold mt-1">{reservations.length} reservas activas</p>
            </div>

            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 shadow-xs">
              <div className="flex items-center gap-2 text-amber-700 mb-1">
                <FiShoppingBag className="text-lg" />
                <span className="text-[10px] uppercase font-bold tracking-wider">Ingreso Bar/Snack</span>
              </div>
              <p className="text-2xl font-black text-amber-800">{formatCOP(financials.totalBar)}</p>
              <p className="text-[10px] text-amber-600/70 font-semibold mt-1">{sales.length} ventas POS registradas</p>
            </div>
          </div>

          {/* Payment Methods Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Metodos de pago en reservas */}
            <div className="lg:col-span-1 bg-white rounded-2xl border border-outline-variant/30 p-5 shadow-sm space-y-4">
              <h3 className="font-extrabold text-sm text-on-surface uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
                <FiLayers className="text-primary text-base" /> Métodos de Pago (Reservas)
              </h3>
              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-center text-sm border-b pb-2 border-dashed">
                  <span className="font-bold text-zinc-600">Nequi</span>
                  <span className="font-black text-on-surface">{formatCOP(financials.nequi)}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b pb-2 border-dashed">
                  <span className="font-bold text-zinc-600">Daviplata</span>
                  <span className="font-black text-on-surface">{formatCOP(financials.daviplata)}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b pb-2 border-dashed">
                  <span className="font-bold text-zinc-600">Efectivo</span>
                  <span className="font-black text-on-surface">{formatCOP(financials.efectivo)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-zinc-600">Otros / Sin definir</span>
                  <span className="font-black text-on-surface">{formatCOP(financials.otros)}</span>
                </div>
              </div>
            </div>

            {/* Listado de Reservas Recaudadas */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-outline-variant/30 p-5 shadow-sm space-y-4">
              <h3 className="font-extrabold text-sm text-on-surface uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
                <FiCalendar className="text-primary text-base" /> Detalle de Recaudos (Canchas)
              </h3>
              {reservations.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-6">No hay reservas registradas en este período.</p>
              ) : (
                <div className="overflow-x-auto max-h-[250px] overflow-y-auto hide-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase tracking-wider font-semibold">
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3">Cancha/Fecha</th>
                        <th className="py-2.5 px-3">Precio</th>
                        <th className="py-2.5 px-3">Abono (Método)</th>
                        <th className="py-2.5 px-3">Saldo (Método)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {reservations.map((r) => {
                        const isPhysical = r.created_by?.includes("(Físico)");
                        const clientName = isPhysical ? r.created_by : (profiles[r.user_id] ?? r.created_by);
                        const hasRemainder = r.deposit_cop === r.price_cop;
                        return (
                          <tr key={r.id} className="hover:bg-zinc-50/50">
                            <td className="py-2.5 px-3 font-semibold text-zinc-900">{clientName}</td>
                            <td className="py-2.5 px-3 text-zinc-500">
                              Cancha {r.court_id} <br /> {r.date} a las {String(r.hour).padStart(2, "0")}:00
                            </td>
                            <td className="py-2.5 px-3 font-bold text-zinc-900">{formatCOP(r.price_cop)}</td>
                            <td className="py-2.5 px-3">
                              {r.deposit_paid ? (
                                <span className="font-semibold text-green-700">
                                  {formatCOP(Math.round(r.price_cop * (r.deposit_percent ?? 30) / 100))}
                                  <span className="text-[10px] text-zinc-400 font-bold ml-1">
                                    ({(r.deposit_payment_method ?? "nequi").toUpperCase()})
                                  </span>
                                </span>
                              ) : (
                                <span className="text-red-500 italic">No pagado</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {hasRemainder ? (
                                <span className="font-semibold text-green-700">
                                  {formatCOP(r.price_cop - Math.round(r.price_cop * (r.deposit_percent ?? 30) / 100))}
                                  <span className="text-[10px] text-zinc-400 font-bold ml-1">
                                    ({(r.balance_payment_method ?? "nequi").toUpperCase()})
                                  </span>
                                </span>
                              ) : (
                                <span className="text-zinc-400 italic">Pendiente</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Bar Sales Detail */}
          <div className="bg-white rounded-2xl border border-outline-variant/30 p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-on-surface uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
              <FiShoppingBag className="text-primary text-base" /> Detalle de Ventas POS (Snack Bar)
            </h3>
            {sales.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-6">No hay ventas registradas en el bar en este período.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto hide-scrollbar">
                {sales.map((s) => (
                  <div key={s.id} className="border border-zinc-100 rounded-xl p-3 bg-zinc-50/50 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-zinc-800">Factura POS #{s.id.slice(0, 6).toUpperCase()}</p>
                      <p className="text-zinc-500">{new Date(s.sold_at).toLocaleString("es-CO")}</p>
                    </div>
                    <span className="font-black text-sm text-zinc-900">{formatCOP(s.total_cop)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
