"use client";

import { useEffect, useState, useMemo } from "react";
import { FiLoader, FiCheck, FiX, FiFileText, FiRefreshCw } from "react-icons/fi";
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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [profiles, setProfiles] = useState<Record<string, { username: string; phone: string }>>({});

  const billingService = useMemo(() => new BillingService(supabase), [supabase]);
  const profileRepo = useMemo(() => new ProfileRepository(supabase), [supabase]);

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

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <FiLoader className="animate-spin text-3xl text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-black tracking-tight text-on-surface">Facturas</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">{filteredInvoices.length} facturas</p>
        </div>
        <button
          onClick={loadData}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white border border-outline-variant/40 rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container transition-colors"
        >
          <FiRefreshCw className="text-sm" /> Recargar
        </button>
      </div>

      {/* Search + Filter */}
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

      {/* Invoice List */}
      {filteredInvoices.length === 0 ? (
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
    </div>
  );
}

// ─── Invoice Card ─────────────────────────────────────────────────────────────

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
