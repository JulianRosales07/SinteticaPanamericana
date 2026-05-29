"use client";

import { useEffect, useMemo, useState } from "react";
import { FiLoader, FiSave } from "react-icons/fi";
import { Button } from "../../../components/Button";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

type SaleRow = { id: string; sold_at: string; total_cop: number };
type SaleItemRow = {
  sale_id: string;
  product_id: number;
  qty: number;
  line_total_cop: number;
  // Supabase puede devolver relación como objeto o arreglo según la configuración/inferencia
  products?: { name: string } | { name: string }[] | null;
};
type CashClosingRow = {
  id: number;
  date: string;
  sales_total_cop: number;
  counted_cop: number;
  difference_cop: number;
  notes: string | null;
  created_at: string;
};

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function startOfDayISO(yyyyMmDd: string) {
  return new Date(`${yyyyMmDd}T00:00:00`).toISOString();
}
function nextDayISO(yyyyMmDd: string) {
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export default function AdminCuadrePage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [items, setItems] = useState<SaleItemRow[]>([]);
  const [closing, setClosing] = useState<CashClosingRow | null>(null);
  const [counted, setCounted] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const salesTotal = sales.reduce((acc, s) => acc + (s.total_cop ?? 0), 0);
  const countedNum = Number(counted) || 0;
  const diff = countedNum - salesTotal;

  const byProduct = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>();
    for (const it of items) {
      const rel = it.products;
      const relName = Array.isArray(rel) ? rel[0]?.name : rel?.name;
      const name = relName ?? `Producto #${it.product_id}`;
      const prev = map.get(name) ?? { name, qty: 0, total: 0 };
      prev.qty += it.qty ?? 0;
      prev.total += it.line_total_cop ?? 0;
      map.set(name, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [items]);

  async function load() {
    setIsLoading(true);
    setError(null);
    setClosing(null);
    setCounted("0");
    setNotes("");

    const start = startOfDayISO(date);
    const end = nextDayISO(date);

    const { data: sData, error: sErr } = await supabase
      .from("sales")
      .select("id, sold_at, total_cop")
      .gte("sold_at", start)
      .lt("sold_at", end)
      .order("sold_at", { ascending: true });
    if (sErr) {
      setError(sErr.message);
      setSales([]);
      setItems([]);
      setIsLoading(false);
      return;
    }
    const sList = (sData ?? []) as SaleRow[];
    setSales(sList);

    if (sList.length > 0) {
      const saleIds = sList.map((s) => s.id);
      const { data: iData, error: iErr } = await supabase
        .from("sale_items")
        .select("sale_id, product_id, qty, line_total_cop, products(name)")
        .in("sale_id", saleIds);
      if (iErr) setError(iErr.message);
      setItems((iData ?? []) as SaleItemRow[]);
    } else {
      setItems([]);
    }

    const { data: cData } = await supabase
      .from("cash_closings")
      .select("id, date, sales_total_cop, counted_cop, difference_cop, notes, created_at")
      .eq("date", date)
      .maybeSingle();

    if (cData) {
      const c = cData as CashClosingRow;
      setClosing(c);
      setCounted(String(c.counted_cop));
      setNotes(c.notes ?? "");
    }

    setIsLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function saveClosing() {
    setError(null);
    const payload = {
      date,
      sales_total_cop: salesTotal,
      counted_cop: countedNum,
      difference_cop: diff,
      notes: notes.trim() || null,
    };

    if (closing) {
      const { data, error } = await supabase
        .from("cash_closings")
        .update(payload)
        .eq("id", closing.id)
        .select()
        .single();
      if (error) return setError(error.message);
      setClosing(data as CashClosingRow);
      return;
    }

    const { data, error } = await supabase
      .from("cash_closings")
      .insert(payload)
      .select()
      .single();

    if (error) return setError(error.message);
    setClosing(data as CashClosingRow);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <FiLoader className="animate-spin text-3xl text-red-700" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Cuadre de caja</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Resumen de ventas por día y registro del efectivo contado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none"
          />
          <Button type="button" onClick={load}>
            Recargar
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6">
          <div className="text-xs font-semibold text-zinc-500">Total vendido</div>
          <div className="mt-2 text-2xl font-black text-red-700">
            {formatCOP(salesTotal)}
          </div>
          <div className="mt-2 text-xs text-zinc-500">{sales.length} ventas</div>
        </div>
        <div className="rounded-3xl border border-zinc-200 bg-white p-6">
          <div className="text-xs font-semibold text-zinc-500">Efectivo contado</div>
          <input
            type="number"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none"
          />
        </div>
        <div className="rounded-3xl border border-zinc-200 bg-white p-6">
          <div className="text-xs font-semibold text-zinc-500">Diferencia</div>
          <div
            className={
              "mt-2 text-2xl font-black " +
              (diff === 0 ? "text-green-700" : diff > 0 ? "text-blue-700" : "text-red-700")
            }
          >
            {formatCOP(diff)}
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            {diff === 0
              ? "Cuadre exacto"
              : diff > 0
                ? "Sobra dinero"
                : "Falta dinero"}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-6">
        <div className="text-lg font-extrabold">Detalle por producto</div>
        {byProduct.length === 0 ? (
          <div className="mt-3 text-sm text-zinc-600">No hay ventas para este día.</div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
            <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              <div className="col-span-6">Producto</div>
              <div className="col-span-3">Cantidad</div>
              <div className="col-span-3 text-right">Total</div>
            </div>
            <div className="divide-y divide-zinc-200 bg-white">
              {byProduct.map((p) => (
                <div key={p.name} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                  <div className="col-span-6 font-semibold">{p.name}</div>
                  <div className="col-span-3">{p.qty}</div>
                  <div className="col-span-3 text-right font-semibold">{formatCOP(p.total)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-2">
          <label className="text-xs font-semibold text-zinc-600">Notas</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none"
          />
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-zinc-500">
            {closing
              ? `Cuadre guardado el ${new Date(closing.created_at).toLocaleString("es-CO")}.`
              : "Aún no se ha guardado el cuadre para este día."}
          </div>
          <Button type="button" onClick={saveClosing}>
            <FiSave /> {closing ? "Actualizar cuadre" : "Guardar cuadre"}
          </Button>
        </div>
      </div>
    </div>
  );
}
