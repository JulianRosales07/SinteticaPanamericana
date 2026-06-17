"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { FiLoader, FiCheck, FiX, FiFileText, FiRefreshCw, FiUpload, FiTrash2, FiImage, FiEye } from "react-icons/fi";
import { Button, LinkButton } from "../../../components/Button";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { BillingService, ProfileRepository } from "../../../lib/core";

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AdminInvoicesPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"canchas" | "proveedores">("canchas");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [profiles, setProfiles] = useState<Record<string, { username: string; phone: string }>>({});

  const billingService = useMemo(() => new BillingService(supabase), [supabase]);
  const profileRepo = useMemo(() => new ProfileRepository(supabase), [supabase]);

  // Proveedores
  const [supplierInvoices, setSupplierInvoices] = useState<any[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(true);
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadSupplier, setUploadSupplier] = useState("");
  const [uploadAmount, setUploadAmount] = useState("");
  const [uploadDate, setUploadDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSupplierInvoices = useCallback(async () => {
    setSupplierLoading(true);
    const { data } = await supabase
      .from("supplier_invoices")
      .select("*")
      .order("created_at", { ascending: false });
    setSupplierInvoices(data ?? []);
    setSupplierLoading(false);
  }, [supabase]);

  useEffect(() => { loadSupplierInvoices(); }, [loadSupplierInvoices]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setUploadFile(file);
    setUploadPreview(file ? URL.createObjectURL(file) : null);
    setUploadError(null);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) { setUploadError("Selecciona una imagen."); return; }
    if (!uploadDescription.trim()) { setUploadError("Ingresa una descripción."); return; }
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) throw new Error("No autenticado");

      const ext = uploadFile.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from("supplier-invoices")
        .upload(path, uploadFile, { upsert: false });
      if (storageErr) throw storageErr;

      const { data: urlData } = supabase.storage
        .from("supplier-invoices")
        .getPublicUrl(path);

      const { error: dbErr } = await supabase.from("supplier_invoices").insert({
        uploaded_by: user.id,
        description: uploadDescription.trim(),
        supplier_name: uploadSupplier.trim() || null,
        amount_cop: uploadAmount ? parseInt(uploadAmount) : null,
        invoice_date: uploadDate || null,
        image_path: path,
        image_url: urlData?.publicUrl ?? null,
      });
      if (dbErr) throw dbErr;

      setUploadSuccess("Factura subida correctamente.");
      setUploadDescription("");
      setUploadSupplier("");
      setUploadAmount("");
      setUploadDate(new Date().toISOString().slice(0, 10));
      setUploadFile(null);
      setUploadPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadSupplierInvoices();
    } catch (err: any) {
      setUploadError(err?.message ?? "Error al subir la factura.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteSupplier(inv: any) {
    if (!confirm("¿Eliminar esta factura? Esta acción no se puede deshacer.")) return;
    setDeletingId(inv.id);
    try {
      await supabase.storage.from("supplier-invoices").remove([inv.image_path]);
      await supabase.from("supplier_invoices").delete().eq("id", inv.id);
      setSupplierInvoices((prev) => prev.filter((i) => i.id !== inv.id));
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function getSignedUrl(path: string) {
    const { data } = await supabase.storage
      .from("supplier-invoices")
      .createSignedUrl(path, 60 * 5); // 5 minutos
    if (data?.signedUrl) setPreviewUrl(data.signedUrl);
  }

  async function loadData() {
    setLoading(true);
    try {
      const invData = await billingService.getAllInvoices();
      const profData = await profileRepo.getAllProfiles();

      if (profData) {
        const profMap: Record<string, { username: string; phone: string }> = {};
        profData.forEach((p) => {
          profMap[p.id] = {
            username: p.username ?? "Usuario",
            phone: p.phone ?? "Sin teléfono",
          };
        });
        setProfiles(profMap);
      }

      if (invData) {
        setInvoices(invData);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markAsPaid(invoiceId: string, amountTotal: number) {
    setUpdatingId(invoiceId);
    try {
      const inv = invoices.find((i) => i.id === invoiceId);
      await billingService.markInvoiceAsPaid(invoiceId, amountTotal, inv?.reservation_id);
      await loadData();
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function markAsCancelled(invoiceId: string) {
    setUpdatingId(invoiceId);
    try {
      const inv = invoices.find((i) => i.id === invoiceId);
      await billingService.markInvoiceAsCancelled(invoiceId, inv?.reservation_id);
      await loadData();
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const profile = profiles[inv.user_id] || { username: "", phone: "" };
      const matchesSearch =
        inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
        profile.username.toLowerCase().includes(search.toLowerCase()) ||
        profile.phone.includes(search);

      const matchesStatus =
        statusFilter === "all" || inv.payment_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter, profiles]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl lg:text-2xl font-black tracking-tight text-on-surface">Facturas</h2>
        <p className="text-sm text-on-surface-variant mt-0.5">Gestión de facturas de canchas y proveedores</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-outline-variant/30 pb-px">
        <button
          onClick={() => setActiveTab("canchas")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "canchas"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-lg">sports_soccer</span>
          Facturas Canchas
          <span className="ml-1 text-[10px] bg-surface-container-high px-2 py-0.5 rounded-full font-bold text-on-surface-variant">
            {invoices.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("proveedores")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "proveedores"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-lg">receipt_long</span>
          Facturas Proveedores
          <span className="ml-1 text-[10px] bg-surface-container-high px-2 py-0.5 rounded-full font-bold text-on-surface-variant">
            {supplierInvoices.length}
          </span>
        </button>
      </div>

      {/* â”€â”€ TAB: Facturas Canchas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {activeTab === "canchas" && (
        <>
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
            <p className="text-sm text-on-surface-variant font-semibold">{filteredInvoices.length} facturas</p>
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-outline-variant/40 rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container transition-colors"
            >
              <FiRefreshCw className="text-sm" /> Recargar
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-xl">search</span>
              <input
                type="text"
                placeholder="Buscar cliente o factura..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant/40 bg-white text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary sm:w-[160px]"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="partially_paid">Anticipo</option>
              <option value="paid">Pagado</option>
              <option value="cancelled">Anulado</option>
            </select>
          </div>

          {loading ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <FiLoader className="animate-spin text-3xl text-primary" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="rounded-xl border border-outline-variant/30 bg-white p-8 text-center text-sm text-on-surface-variant">
              No se encontraron facturas.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredInvoices.map((inv) => (
                <InvoiceCard
                  key={inv.id}
                  invoice={inv}
                  client={profiles[inv.user_id] || { username: "Usuario", phone: "—" }}
                  isUpdating={updatingId === inv.id}
                  onMarkPaid={() => markAsPaid(inv.id, inv.amount_total)}
                  onMarkCancelled={() => markAsCancelled(inv.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* â”€â”€ TAB: Facturas Proveedores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {activeTab === "proveedores" && (
        <>
          {/* Formulario de subida */}
          <div className="bg-white rounded-2xl border border-outline-variant/30 p-5 shadow-sm">
            <h4 className="text-sm font-bold text-on-surface mb-4 flex items-center gap-1.5">
              <FiUpload className="text-primary" /> Subir nueva factura de proveedor
            </h4>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Descripción *</label>
                  <input
                    type="text"
                    required
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="Ej: Compra bebidas proveedor XYZ"
                    className="w-full rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Proveedor</label>
                  <input
                    type="text"
                    value={uploadSupplier}
                    onChange={(e) => setUploadSupplier(e.target.value)}
                    placeholder="Ej: Distribuidora Norte"
                    className="w-full rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Valor (COP)</label>
                  <input
                    type="number"
                    min={0}
                    value={uploadAmount}
                    onChange={(e) => setUploadAmount(e.target.value)}
                    placeholder="Ej: 250000"
                    className="w-full rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Fecha de factura</label>
                  <input
                    type="date"
                    value={uploadDate}
                    onChange={(e) => setUploadDate(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-outline-variant/40 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                {uploadPreview ? (
                  <img src={uploadPreview} alt="preview" className="max-h-40 rounded-lg object-contain shadow" />
                ) : (
                  <>
                    <FiImage className="text-3xl text-outline-variant" />
                    <p className="text-sm font-semibold text-on-surface-variant">Haz click para seleccionar imagen</p>
                    <p className="text-xs text-outline">JPG, PNG, WEBP — máx. 10 MB</p>
                  </>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>

              {uploadFile && (
                <p className="text-xs text-on-surface-variant font-semibold">
                  {uploadFile.name} ({(uploadFile.size / 1024).toFixed(0)} KB)
                </p>
              )}
              {uploadError && <p className="text-xs text-red-600 font-semibold">{uploadError}</p>}
              {uploadSuccess && <p className="text-xs text-green-600 font-semibold">{uploadSuccess}</p>}

              <button
                type="submit"
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {uploading ? <FiLoader className="animate-spin" /> : <FiUpload />}
                {uploading ? "Subiendo..." : "Subir Factura"}
              </button>
            </form>
          </div>

          {/* Listado */}
          <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant/20">
              <p className="text-sm font-bold text-on-surface flex items-center gap-2">
                Facturas guardadas
                {!supplierLoading && (
                  <span className="text-xs text-on-surface-variant font-semibold bg-surface-container px-2 py-0.5 rounded-full">
                    {supplierInvoices.length}
                  </span>
                )}
              </p>
              <button onClick={loadSupplierInvoices} className="p-1.5 rounded-lg hover:bg-surface-container transition-colors">
                <FiRefreshCw className={`text-sm text-outline ${supplierLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {supplierLoading ? (
              <div className="flex items-center justify-center py-10">
                <FiLoader className="animate-spin text-2xl text-primary" />
              </div>
            ) : supplierInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FiImage className="text-4xl text-outline-variant/40 mb-2" />
                <p className="text-sm font-semibold text-on-surface-variant">No hay facturas de proveedores aún</p>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/20">
                {supplierInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-container/50 transition-colors">
                    <div
                      className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center shrink-0 cursor-pointer border border-outline-variant/20 hover:border-primary/40 transition-colors"
                      onClick={() => getSignedUrl(inv.image_path)}
                    >
                      <FiImage className="text-xl text-outline-variant" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-on-surface truncate">{inv.description}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {inv.supplier_name && <span className="text-[11px] text-on-surface-variant font-semibold">{inv.supplier_name}</span>}
                        {inv.invoice_date && <span className="text-[11px] text-outline">{inv.invoice_date}</span>}
                        {inv.amount_cop && <span className="text-[11px] font-bold text-emerald-700">{formatCOP(inv.amount_cop)}</span>}
                      </div>
                      <p className="text-[10px] text-outline mt-0.5">
                        Subida: {new Date(inv.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => getSignedUrl(inv.image_path)}
                        className="p-2 rounded-lg border border-outline-variant/30 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                        title="Ver imagen"
                      >
                        <FiEye className="text-sm" />
                      </button>
                      <button
                        onClick={() => handleDeleteSupplier(inv)}
                        disabled={deletingId === inv.id}
                        className="p-2 rounded-lg border border-outline-variant/30 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Eliminar"
                      >
                        {deletingId === inv.id ? <FiLoader className="animate-spin text-sm" /> : <FiTrash2 className="text-sm" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de previsualización */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-4 -right-4 bg-white rounded-full p-2 shadow-lg hover:bg-red-50 transition-colors z-10"
            >
              <FiX className="text-lg" />
            </button>
            <img src={previewUrl} alt="Factura" className="w-full rounded-2xl shadow-2xl object-contain max-h-[80vh]" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Invoice Card ────────────────────────────────────────────────────────────

function InvoiceCard({
  invoice: inv,
  client,
  isUpdating,
  onMarkPaid,
  onMarkCancelled,
}: {
  invoice: any;
  client: { username: string; phone: string };
  isUpdating: boolean;
  onMarkPaid: () => void;
  onMarkCancelled: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const res = inv.reservations;

  const statusConfig: Record<string, { label: string; cls: string }> = {
    paid: { label: "Pagado", cls: "bg-green-100 text-green-700" },
    partially_paid: { label: "Anticipo", cls: "bg-blue-100 text-blue-700" },
    cancelled: { label: "Anulado", cls: "bg-zinc-100 text-zinc-600" },
    pending: { label: "Pendiente", cls: "bg-amber-100 text-amber-700" },
  };

  const status = statusConfig[inv.payment_status] || statusConfig.pending;

  return (
    <div className="bg-white rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden">
      {/* Compact row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-3 text-left"
      >
        {/* Invoice number */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-on-surface">{inv.invoice_number}</p>
          <p className="text-[11px] text-on-surface-variant truncate">{client.username}</p>
        </div>

        {/* Amount */}
        <span className="text-xs font-bold text-on-surface shrink-0">{formatCOP(inv.amount_total)}</span>

        {/* Status */}
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${status.cls}`}>
          {status.label}
        </span>

        {/* Chevron */}
        <span className={`material-symbols-outlined text-lg text-outline transition-transform ${expanded ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-outline-variant/20 pt-2 space-y-3">
          {/* Client + Reservation info */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-[10px] uppercase font-bold text-outline">Cliente</p>
              <p className="font-semibold text-on-surface">{client.username}</p>
              <p className="text-on-surface-variant">{client.phone}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-outline">Reserva</p>
              {res ? (
                <>
                  <p className="font-semibold text-on-surface">Cancha {res.court_id} • {res.date}</p>
                  <p className="text-on-surface-variant">Hora: {String(res.hour).padStart(2, "0")}:00</p>
                </>
              ) : (
                <p className="text-red-500 italic">Sin reserva</p>
              )}
            </div>
          </div>

          {/* Amounts */}
          <div className="bg-surface-container-low rounded-lg p-2 grid grid-cols-3 gap-1 text-center">
            <div>
              <p className="text-[8px] uppercase font-bold text-outline">Total</p>
              <p className="text-[11px] font-bold text-on-surface">{formatCOP(inv.amount_total)}</p>
            </div>
            <div className="border-x border-outline-variant/20">
              <p className="text-[8px] uppercase font-bold text-green-600">Pagado</p>
              <p className="text-[11px] font-bold text-green-700">{formatCOP(inv.amount_paid)}</p>
            </div>
            <div>
              <p className="text-[8px] uppercase font-bold text-red-500">Pendiente</p>
              <p className="text-[11px] font-bold text-red-600">{formatCOP(Math.max(0, inv.amount_total - inv.amount_paid))}</p>
            </div>
          </div>

          {/* Date */}
          <p className="text-[10px] text-on-surface-variant">
            Creada: {new Date(inv.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
          </p>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <LinkButton
              href={`/facturas/${inv.id}`}
              variant="ghost"
              className="flex-1 min-w-[70px] border border-outline-variant/40 bg-white text-on-surface text-xs px-3 py-2 rounded-lg"
            >
              <FiFileText /> Detalle
            </LinkButton>

            {inv.payment_status !== "paid" && inv.payment_status !== "cancelled" && (
              <Button
                type="button"
                onClick={onMarkPaid}
                disabled={isUpdating}
                className="flex-1 min-w-[70px] bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-2 rounded-lg"
              >
                <FiCheck /> Pagado
              </Button>
            )}

            {inv.payment_status !== "cancelled" && (
              <Button
                type="button"
                onClick={onMarkCancelled}
                disabled={isUpdating}
                className="flex-1 min-w-[70px] bg-zinc-100 border border-zinc-200 text-zinc-700 hover:bg-zinc-200 text-xs px-3 py-2 rounded-lg"
              >
                <FiX /> Anular
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
