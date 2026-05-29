"use client";

import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiLoader, FiPlus, FiRefreshCw } from "react-icons/fi";
import { Button } from "../../../components/Button";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

type ProductRow = {
  id: number;
  name: string;
  stock_qty: number;
  price_cop: number;
  active: boolean;
};

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AdminVentasPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("products")
      .select("id, name, stock_qty, price_cop, active")
      .order("name", { ascending: true });
    if (error) setError(error.message);
    const list = ((data ?? []) as ProductRow[]).filter((p) => p.active);
    setProducts(list);
    setIsLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = products.reduce((acc, p) => {
    const q = qty[p.id] ?? 0;
    return acc + q * p.price_cop;
  }, 0);

  async function createSale() {
    setError(null);
    setSuccess(null);
    const items = products
      .map((p) => ({ product_id: p.id, qty: qty[p.id] ?? 0 }))
      .filter((i) => i.qty > 0);

    if (items.length === 0) {
      setError("Selecciona al menos un producto con cantidad > 0.");
      return;
    }

    setIsSaving(true);
    // RPC en BD para que sea atómico (descuenta stock + crea venta)
    const { data, error } = await supabase.rpc("create_sale", { items });
    setIsSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(String(data));
    setQty({});
    await load();
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
          <h2 className="text-2xl font-black tracking-tight">Registrar ventas</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Selecciona productos, registra la venta y se descuenta el inventario.
          </p>
        </div>
        <Button type="button" onClick={load}>
          <FiRefreshCw /> Recargar
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <div className="flex items-center gap-2 font-semibold">
            <FiCheckCircle /> Venta registrada
          </div>
          <div className="mt-1 text-xs text-green-700">
            Id venta: <span className="font-mono">{success}</span>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-zinc-200">
        <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-5 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-600">
          <div className="col-span-6">Producto</div>
          <div className="col-span-2">Stock</div>
          <div className="col-span-2">Precio</div>
          <div className="col-span-2">Cantidad</div>
        </div>
        <div className="divide-y divide-zinc-200 bg-white">
          {products.map((p) => (
            <div key={p.id} className="grid grid-cols-12 items-center gap-2 px-5 py-4 text-sm">
              <div className="col-span-6">
                <div className="font-semibold">{p.name}</div>
                <div className="mt-1 font-mono text-[11px] text-zinc-500">#{p.id}</div>
              </div>
              <div className="col-span-2">{p.stock_qty}</div>
              <div className="col-span-2 text-zinc-700">{formatCOP(p.price_cop)}</div>
              <div className="col-span-2">
                <input
                  type="number"
                  min={0}
                  max={p.stock_qty}
                  value={qty[p.id] ?? 0}
                  onChange={(e) =>
                    setQty((prev) => ({
                      ...prev,
                      [p.id]: Math.max(0, Number(e.target.value)),
                    }))
                  }
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-zinc-50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold text-zinc-500">Total</div>
          <div className="mt-1 text-2xl font-black text-red-700">{formatCOP(total)}</div>
        </div>
        <Button type="button" onClick={createSale} disabled={isSaving}>
          <FiPlus /> {isSaving ? "Guardando..." : "Registrar venta"}
        </Button>
      </div>
    </div>
  );
}

