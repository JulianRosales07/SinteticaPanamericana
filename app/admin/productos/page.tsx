"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiDownload, FiLoader, FiPlus, FiTrash2, FiUpload, FiAlertTriangle, FiX } from "react-icons/fi";
import { Button } from "../../../components/Button";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import * as XLSX from "xlsx";

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
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: number; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // Soft delete: solo desactivar
    const { error } = await supabase
      .from("products")
      .update({ active: false })
      .eq("id", id);
    if (error) return setError(error.message);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, active: false } : r)));
  }

  async function forceDeleteProduct(id: number) {
    setError(null);
    setDeleteModal(null);

    const { error } = await supabase.rpc("force_delete_product", { p_product_id: id });
    if (error) return setError(error.message);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  // ─── Excel: Descargar Plantilla ───
  function downloadTemplate() {
    const templateData = [
      { nombre: "Ejemplo: Gatorade", cantidad: 24, precio: 5000, activo: "SI" },
      { nombre: "Ejemplo: Agua Mineral", cantidad: 48, precio: 2000, activo: "SI" },
      { nombre: "Ejemplo: Papas Margarita", cantidad: 10, precio: 3000, activo: "SI" },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);

    // Ajustar anchos de columnas
    ws["!cols"] = [
      { wch: 30 }, // nombre
      { wch: 12 }, // cantidad
      { wch: 12 }, // precio
      { wch: 8 },  // activo
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");

    XLSX.writeFile(wb, "plantilla_productos.xlsx");
  }

  // ─── Excel: Importar Productos ───
  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setImportSuccess(null);
    setIsImporting(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      if (jsonData.length === 0) {
        setError("El archivo Excel está vacío o no tiene datos válidos.");
        setIsImporting(false);
        return;
      }

      // Mapear columnas (flexible con variaciones de nombre)
      const products = jsonData.map((row) => {
        const name = String(
          row["nombre"] ?? row["Nombre"] ?? row["NOMBRE"] ?? row["name"] ?? row["Name"] ?? ""
        ).trim();
        const stock_qty = Number(
          row["cantidad"] ?? row["Cantidad"] ?? row["CANTIDAD"] ?? row["stock"] ?? row["Stock"] ?? 0
        );
        const price_cop = Number(
          row["precio"] ?? row["Precio"] ?? row["PRECIO"] ?? row["price"] ?? row["Price"] ?? 0
        );
        const activeRaw = String(
          row["activo"] ?? row["Activo"] ?? row["ACTIVO"] ?? row["active"] ?? "SI"
        ).toUpperCase();
        const active = activeRaw === "SI" || activeRaw === "YES" || activeRaw === "TRUE" || activeRaw === "1";

        return { name, stock_qty, price_cop, active };
      });

      // Validar
      const validProducts = products.filter((p) => p.name && p.name.length > 0 && !p.name.startsWith("Ejemplo:"));
      
      if (validProducts.length === 0) {
        setError("No se encontraron productos válidos. Asegúrate de que la columna 'nombre' tenga datos (y elimina las filas de ejemplo).");
        setIsImporting(false);
        return;
      }

      // Insertar en lote en Supabase
      const { data: inserted, error: insertError } = await supabase
        .from("products")
        .insert(validProducts)
        .select("id, name, stock_qty, price_cop, active, created_at");

      if (insertError) {
        setError(`Error al importar: ${insertError.message}`);
        setIsImporting(false);
        return;
      }

      setImportSuccess(`Se importaron ${(inserted ?? []).length} productos exitosamente.`);
      await load();
    } catch (err) {
      setError(`Error al leer el archivo: ${err instanceof Error ? err.message : "Error desconocido"}`);
    } finally {
      setIsImporting(false);
      // Resetear input para permitir subir el mismo archivo de nuevo
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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
      {importSuccess && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
          {importSuccess}
        </div>
      )}

      {/* ─── Importar / Exportar Excel ─── */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6">
        <div className="text-lg font-extrabold mb-1">Importar desde Excel</div>
        <p className="text-sm text-zinc-500 mb-4">
          Descarga la plantilla, llénala con tus productos y súbela aquí para importarlos masivamente.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button type="button" variant="secondary" onClick={downloadTemplate}>
            <FiDownload /> Descargar plantilla (.xlsx)
          </Button>
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            <FiUpload /> {isImporting ? "Importando..." : "Importar productos"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileImport}
            className="hidden"
          />
        </div>
      </div>

      {/* ─── Agregar producto manual ─── */}
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

      {/* ─── Tabla de productos ─── */}
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
                <div className="col-span-2 flex justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    className="border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100"
                    onClick={() => deleteProduct(r.id)}
                    title="Desactivar producto"
                  >
                    <FiTrash2 /> Desactivar
                  </Button>
                  <button
                    type="button"
                    className="text-[11px] text-red-500 hover:text-red-700 underline font-semibold px-2"
                    onClick={() => setDeleteModal({ id: r.id, name: r.name })}
                    title="Eliminar permanentemente (borra historial de ventas)"
                  >
                    Eliminar
                  </button>
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

      {/* ─── Modal de confirmación para eliminar ─── */}
      {deleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteModal(null)}
          />
          {/* Modal */}
          <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl border border-zinc-200 overflow-hidden animate-in">
            {/* Header con icono */}
            <div className="bg-red-50 px-6 pt-6 pb-4 flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <FiAlertTriangle className="text-red-600 text-xl" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-zinc-900">Eliminar producto</h3>
                <p className="text-sm text-zinc-600 mt-1">
                  Esta acción no se puede deshacer.
                </p>
              </div>
              <button
                onClick={() => setDeleteModal(null)}
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <FiX className="text-xl" />
              </button>
            </div>
            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-sm text-zinc-700">
                Estás a punto de eliminar permanentemente{" "}
                <span className="font-bold text-zinc-900">&ldquo;{deleteModal.name}&rdquo;</span>{" "}
                junto con todo su historial de ventas asociado.
              </p>
              <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
                <span className="text-amber-600 text-lg mt-0.5">⚠️</span>
                <p className="text-xs text-amber-800">
                  Se eliminarán los registros de este producto en todas las ventas donde fue incluido. Los totales de esas ventas podrían quedar inconsistentes.
                </p>
              </div>
            </div>
            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-5 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => forceDeleteProduct(deleteModal.id)}
                className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
              >
                Sí, eliminar permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
