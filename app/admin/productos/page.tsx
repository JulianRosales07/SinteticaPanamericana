"use client";

import { useEffect, useMemo, useState } from "react";
import { FiLoader, FiPlus, FiTrash2 } from "react-icons/fi";
import { Button } from "../../../components/Button";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

type ProductRow = {
  id: number;
  name: string;
  stock_qty: number;
  price_cop: number;
  active: boolean;
  created_at: string;
};

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AdminProductosPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newP, setNewP] = useState<{ name: string; stock_qty: string; price_cop: string; active: boolean }>({
    name: "",
    stock_qty: "0",
    price_cop: "0",
    active: true,
  });

  async function load() {
    setIsLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("products")
      .select("id, name, stock_qty, price_cop, active, created_at")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    setRows((data ?? []) as ProductRow[]);
    setIsLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createProduct() {
    setError(null);
    const payload = {
      name: newP.name.trim(),
      stock_qty: Number(newP.stock_qty),
      price_cop: Number(newP.price_cop),
      active: Boolean(newP.active),
    };
    if (!payload.name) return setError("Ingresa el nombre del producto.");
    if (!payload.price_cop || payload.price_cop < 0) return setError("Ingresa un precio válido.");
    if (Number.isNaN(payload.stock_qty) || payload.stock_qty < 0) return setError("Ingresa una cantidad válida.");

    const { data, error } = await supabase
      .from("products")
      .insert(payload)
      .select("id, name, stock_qty, price_cop, active, created_at")
      .single();
    if (error) return setError(error.message);
    setRows((prev) => [data as ProductRow, ...prev]);
    setNewP({ name: "", stock_qty: "0", price_cop: "0", active: true });
  }

  async function updateProduct(id: number, patch: Partial<ProductRow>) {
    setError(null);
    const { error } = await supabase.from("products").update(patch).eq("id", id);
    if (error) return setError(error.message);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function deleteProduct(id: number) {
    setError(null);
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return setError(error.message);
    setRows((prev) => prev.filter((r) => r.id !== id));
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
      <div>
        <h2 className="text-2xl font-black tracking-tight">Productos (inventario)</h2>
        <p className="mt-1 text-sm text-zinc-600">CRUD completo de productos y stock.</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-3xl border border-zinc-200 bg-white p-6">
        <div className="text-lg font-extrabold">Agregar producto</div>
        <div className="mt-4 grid gap-2 md:grid-cols-5">
          <input
            value={newP.name}
            onChange={(e) => setNewP((p) => ({ ...p, name: e.target.value }))}
            placeholder="Nombre"
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm outline-none md:col-span-2"
          />
          <input
            type="number"
            value={newP.stock_qty}
            onChange={(e) => setNewP((p) => ({ ...p, stock_qty: e.target.value }))}
            placeholder="Cantidad"
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm outline-none"
          />
          <input
            type="number"
            value={newP.price_cop}
            onChange={(e) => setNewP((p) => ({ ...p, price_cop: e.target.value }))}
            placeholder="Precio (COP)"
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm outline-none"
          />
          <label className="flex items-center gap-2 text-sm md:justify-end">
            <input
              type="checkbox"
              checked={newP.active}
              onChange={(e) => setNewP((p) => ({ ...p, active: e.target.checked }))}
            />
            Activo
          </label>
          <div className="md:col-span-5">
            <Button type="button" onClick={createProduct} className="w-full">
              <FiPlus /> Crear
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-zinc-200">
        <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-5 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-600">
          <div className="col-span-4">Producto</div>
          <div className="col-span-2">Cantidad</div>
          <div className="col-span-3">Precio</div>
          <div className="col-span-1">Activo</div>
          <div className="col-span-2 text-right">Acciones</div>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-zinc-600">No hay productos.</div>
        ) : (
          <div className="divide-y divide-zinc-200 bg-white">
            {rows.map((r) => (
              <div key={r.id} className="grid grid-cols-12 items-center gap-2 px-5 py-4 text-sm">
                <div className="col-span-4">
                  <input
                    defaultValue={r.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== r.name) updateProduct(r.id, { name: v });
                    }}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm outline-none"
                  />
                  <div className="mt-1 font-mono text-[11px] text-zinc-500">#{r.id}</div>
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    defaultValue={r.stock_qty}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v) && v !== r.stock_qty) updateProduct(r.id, { stock_qty: v });
                    }}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm outline-none"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    defaultValue={r.price_cop}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v) && v !== r.price_cop) updateProduct(r.id, { price_cop: v });
                    }}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm outline-none"
                  />
                  <div className="mt-1 text-xs text-zinc-500">{formatCOP(r.price_cop)}</div>
                </div>
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    checked={r.active}
                    onChange={(e) => updateProduct(r.id, { active: e.target.checked })}
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    className="border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100"
                    onClick={() => deleteProduct(r.id)}
                    title="Eliminar"
                  >
                    <FiTrash2 /> Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={load}>
          Recargar
        </Button>
      </div>
    </div>
  );
}

