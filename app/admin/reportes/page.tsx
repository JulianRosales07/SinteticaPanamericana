"use client";

import { useEffect, useMemo, useState } from "react";
import { FiLoader, FiCalendar, FiDollarSign, FiShoppingBag, FiLayers, FiRefreshCw, FiTrendingUp, FiDownload } from "react-icons/fi";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import * as XLSX from "xlsx";

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

  // Historial de reportes descargados
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyFilter, setHistoryFilter] = useState<"all" | "Diario" | "Semanal" | "Mensual">("all");

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
      const startISO = `${startDate}T00:00:00-05:00`;
      const endISO = `${endDate}T23:59:59.999-05:00`;

      const { data: salesData, error: salesErr } = await supabase
        .from("sales")
        .select(`
          id,
          sold_at,
          total_cop,
          payment_method,
          sale_items (
            qty,
            unit_price_cop,
            products (
              name
            )
          )
        `)
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

  // Cargar historial de reportes
  async function loadHistory() {
    setHistoryLoading(true);
    const { data } = await supabase
      .from("report_downloads")
      .select("*")
      .order("downloaded_at", { ascending: false })
      .limit(100);
    setHistory(data ?? []);
    setHistoryLoading(false);
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cálculos financieros
  const financials = useMemo(() => {
    let totalReservas = 0;
    let totalBar = sales.reduce((acc, s) => acc + (s.total_cop ?? 0), 0);

    // Métodos de pago para reservas
    let nequi = 0;
    let daviplata = 0;
    let efectivo = 0;
    let otros = 0;

    // Métodos de pago para bar/snack
    let barNequi = 0;
    let barDaviplata = 0;
    let barEfectivo = 0;
    let barOtros = 0;

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

    // Calcular métodos de pago del bar
    for (const s of sales) {
      const method = (s.payment_method ?? "efectivo").toLowerCase();
      const amount = s.total_cop ?? 0;
      if (method === "nequi") barNequi += amount;
      else if (method === "daviplata") barDaviplata += amount;
      else if (method === "efectivo") barEfectivo += amount;
      else barOtros += amount;
    }

    return {
      totalReservas,
      totalBar,
      totalCombined: totalReservas + totalBar,
      nequi,
      daviplata,
      efectivo,
      otros,
      barNequi,
      barDaviplata,
      barEfectivo,
      barOtros,
    };
  }, [reservations, sales]);

  // ─── Exportar a Excel ────────────────────────────────────────────────────────
  async function exportToExcel() {
    const wb = XLSX.utils.book_new();

    const periodoLabel =
      filterType === "today" ? "Diario" :
      filterType === "week"  ? "Semanal" :
      filterType === "month" ? "Mensual" : "Personalizado";
    const periodoStr = startDate === endDate ? startDate : `${startDate} al ${endDate}`;

    // Hoja 1: Resumen
    const resumenData = [
      ["REPORTE DE INGRESOS – SINTÉTICAS PANAMERICANA"],
      [`Período: ${periodoLabel} (${periodoStr})`],
      [],
      ["CONCEPTO", "VALOR (COP)"],
      ["Ingresos por Canchas", financials.totalReservas],
      ["Ingresos Bar/Snack", financials.totalBar],
      ["TOTAL GENERAL", financials.totalCombined],
      [],
      ["MÉTODOS DE PAGO (CANCHAS)", ""],
      ["Nequi", financials.nequi],
      ["Daviplata", financials.daviplata],
      ["Efectivo", financials.efectivo],
      ["Otros / Sin definir", financials.otros],
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    wsResumen["!cols"] = [{ wch: 35 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

    // Hoja 2: Detalle Canchas
    const canchasHeaders = ["Cliente", "Cancha", "Fecha", "Hora", "Precio Total", "Abono", "Método Abono", "Saldo", "Método Saldo", "Estado"];
    const canchasRows = reservations.map((r) => {
      const isPhysical = r.created_by?.includes("(Físico)");
      const clientName = isPhysical ? r.created_by : (profiles[r.user_id] ?? r.created_by);
      const depPct = r.deposit_percent ?? 30;
      const abono = r.deposit_paid ? Math.round(r.price_cop * depPct / 100) : 0;
      const saldo = r.deposit_cop === r.price_cop ? r.price_cop - abono : 0;
      return [
        clientName,
        `Cancha ${r.court_id}`,
        r.date,
        `${String(r.hour).padStart(2, "0")}:00`,
        r.price_cop,
        abono,
        r.deposit_paid ? (r.deposit_payment_method ?? "nequi").toUpperCase() : "No pagado",
        saldo,
        saldo > 0 ? (r.balance_payment_method ?? "nequi").toUpperCase() : "Pendiente",
        r.status === "active" ? "Activa" : r.status === "pending_payment" ? "Pago pendiente" : r.status,
      ];
    });
    const wsCanchas = XLSX.utils.aoa_to_sheet([canchasHeaders, ...canchasRows]);
    wsCanchas["!cols"] = [
      { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 8 },
      { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsCanchas, "Canchas");

    // Hoja 3: Detalle Bar/Snack
    const barHeaders = ["ID Venta", "Fecha y Hora", "Productos", "Total (COP)"];
    const barRows = sales.map((s) => {
      const productsStr = s.sale_items && s.sale_items.length > 0
        ? s.sale_items.map((item: any) => `${item.products?.name || "Producto"} (x${item.qty})`).join(", ")
        : "Sin productos";
      return [
        s.id.slice(0, 8).toUpperCase(),
        new Date(s.sold_at).toLocaleString("es-CO"),
        productsStr,
        s.total_cop,
      ];
    });
    const wsBar = XLSX.utils.aoa_to_sheet([barHeaders, ...barRows, [], ["", "", "TOTAL BAR", financials.totalBar]]);
    wsBar["!cols"] = [{ wch: 15 }, { wch: 22 }, { wch: 35 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsBar, "Bar-Snack");

    // ── Guardar registro en la DB ──────────────────────────────────────────────
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      await supabase.from("report_downloads").insert({
        downloaded_by: user?.id ?? null,
        downloaded_by_email: user?.email ?? null,
        period_type: periodoLabel,
        date_from: startDate,
        date_to: endDate,
        total_canchas: financials.totalReservas,
        total_bar: financials.totalBar,
        total_combined: financials.totalCombined,
        reservations_count: reservations.length,
        sales_count: sales.length,
      });
    } catch (err) {
      // No bloquear la descarga si falla el registro
      console.error("Error guardando registro de descarga:", err);
    }

    const fileName = `Reporte_${periodoLabel}_${startDate.replaceAll("-", "")}_Sinteticas.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

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
        <div className="flex items-center gap-2 self-start">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-outline-variant/30 rounded-xl text-xs font-bold hover:bg-surface-container transition-colors"
          >
            <FiRefreshCw className="text-sm" /> Recargar
          </button>
          <button
            onClick={() => exportToExcel()}
            disabled={loading || (reservations.length === 0 && sales.length === 0)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <FiDownload className="text-sm" /> Descargar Excel
          </button>
        </div>
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
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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

            {/* Metodos de pago en bar/snack */}
            <div className="lg:col-span-1 bg-white rounded-2xl border border-outline-variant/30 p-5 shadow-sm space-y-4">
              <h3 className="font-extrabold text-sm text-on-surface uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
                <FiShoppingBag className="text-amber-600 text-base" /> Métodos de Pago (Bar/Snack)
              </h3>
              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-center text-sm border-b pb-2 border-dashed">
                  <span className="font-bold text-zinc-600">Nequi</span>
                  <span className="font-black text-on-surface">{formatCOP(financials.barNequi)}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b pb-2 border-dashed">
                  <span className="font-bold text-zinc-600">Daviplata</span>
                  <span className="font-black text-on-surface">{formatCOP(financials.barDaviplata)}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b pb-2 border-dashed">
                  <span className="font-bold text-zinc-600">Efectivo</span>
                  <span className="font-black text-on-surface">{formatCOP(financials.barEfectivo)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-zinc-600">Otros / Sin definir</span>
                  <span className="font-black text-on-surface">{formatCOP(financials.barOtros)}</span>
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
                {sales.map((s) => {
                  const productsList = s.sale_items && s.sale_items.length > 0
                    ? s.sale_items.map((item: any) => `${item.products?.name || "Producto"} (x${item.qty})`).join(", ")
                    : "Sin productos";
                  return (
                    <div key={s.id} className="border border-zinc-100 rounded-xl p-3 bg-zinc-50/50 flex justify-between items-center text-xs">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-bold text-zinc-800">Factura POS #{s.id.slice(0, 6).toUpperCase()}</p>
                        <p className="text-[11px] text-zinc-600 mt-1 truncate" title={productsList}>
                          {productsList}
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-1">{new Date(s.sold_at).toLocaleString("es-CO")}</p>
                      </div>
                      <span className="font-black text-sm text-zinc-900 shrink-0">{formatCOP(s.total_cop)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Historial de Reportes Descargados ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-4 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <FiDownload className="text-primary text-base" />
            <h3 className="font-extrabold text-sm text-on-surface uppercase tracking-wider">
              Historial de Reportes Descargados
            </h3>
            {!historyLoading && (
              <span className="bg-surface-container-high text-on-surface-variant text-[10px] font-bold px-2 py-0.5 rounded-full">
                {history.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Filtro por tipo */}
            <div className="flex gap-1">
              {(["all", "Diario", "Semanal", "Mensual"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setHistoryFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    historyFilter === f
                      ? "bg-primary text-white"
                      : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  {f === "all" ? "Todos" : f}
                </button>
              ))}
            </div>
            <button
              onClick={loadHistory}
              className="p-1.5 rounded-lg hover:bg-surface-container transition-colors"
              title="Recargar historial"
            >
              <FiRefreshCw className={`text-sm text-outline ${historyLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Tabla */}
        {historyLoading ? (
          <div className="flex items-center justify-center py-10">
            <FiLoader className="animate-spin text-2xl text-primary" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FiDownload className="text-4xl text-outline-variant/40 mb-2" />
            <p className="text-sm font-semibold text-on-surface-variant">No hay reportes descargados aún</p>
            <p className="text-xs text-outline mt-1">Los reportes aparecerán aquí cuando se descarguen</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Fecha Descarga</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Período</th>
                  <th className="py-3 px-4">Canchas</th>
                  <th className="py-3 px-4">Bar</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Reservas</th>
                  <th className="py-3 px-4">Ventas</th>
                  <th className="py-3 px-4">Descargado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {history
                  .filter((h) => historyFilter === "all" || h.period_type === historyFilter)
                  .map((h) => (
                    <tr key={h.id} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="py-2.5 px-4 text-zinc-500 whitespace-nowrap">
                        {new Date(h.downloaded_at).toLocaleString("es-CO", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          h.period_type === "Diario"    ? "bg-blue-100 text-blue-700" :
                          h.period_type === "Semanal"   ? "bg-violet-100 text-violet-700" :
                          h.period_type === "Mensual"   ? "bg-emerald-100 text-emerald-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {h.period_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-zinc-600 whitespace-nowrap font-semibold">
                        {h.date_from === h.date_to ? h.date_from : `${h.date_from} → ${h.date_to}`}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-emerald-700">{formatCOP(h.total_canchas)}</td>
                      <td className="py-2.5 px-4 font-bold text-amber-700">{formatCOP(h.total_bar)}</td>
                      <td className="py-2.5 px-4 font-black text-violet-700">{formatCOP(h.total_combined)}</td>
                      <td className="py-2.5 px-4 text-zinc-500 text-center">{h.reservations_count}</td>
                      <td className="py-2.5 px-4 text-zinc-500 text-center">{h.sales_count}</td>
                      <td className="py-2.5 px-4 text-zinc-500 truncate max-w-[160px]">
                        {h.downloaded_by_email ?? "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
