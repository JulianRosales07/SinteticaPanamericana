"use client";

import { useEffect, useState, useMemo } from "react";
import { FiLoader, FiSearch, FiCheck, FiX, FiFileText, FiRefreshCw, FiDollarSign } from "react-icons/fi";
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
  
  // Search and filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Load profiles as a dictionary for quick lookup by user_id
  const [profiles, setProfiles] = useState<Record<string, { username: string; phone: string }>>({});

  const billingService = useMemo(() => new BillingService(supabase), [supabase]);
  const profileRepo = useMemo(() => new ProfileRepository(supabase), [supabase]);

  async function loadData() {
    setLoading(true);
    try {
      // Fetch all invoices using service layer
      const invData = await billingService.getAllInvoices();

      // Fetch all profiles using profile repository
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
      alert("Error al cargar datos: " + err.message);
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
      alert("Error al actualizar la factura: " + error.message);
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
      alert("Error al anular la factura: " + error.message);
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const profile = profiles[inv.user_id] || { username: "", phone: "" };
      const res = inv.reservations || {};
      const matchesSearch =
        inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
        profile.username.toLowerCase().includes(search.toLowerCase()) ||
        profile.phone.includes(search) ||
        (res.wompi_transaction_id && res.wompi_transaction_id.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus =
        statusFilter === "all" || inv.payment_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter, profiles]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <FiLoader className="animate-spin text-4xl text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Administración de Facturas</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Visualiza y actualiza el estado de las facturas generadas por alquiler de canchas.
          </p>
        </div>
        <Button onClick={loadData} className="border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100 sm:w-auto">
          <FiRefreshCw /> Recargar
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
          <FiSearch className="text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, teléfono o factura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none min-w-[180px]"
        >
          <option value="all">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="partially_paid">Anticipo Pagado</option>
          <option value="paid">Pagado Completo</option>
          <option value="cancelled">Anulado</option>
        </select>
      </div>

      {/* Invoices List */}
      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-soft">
        <div className="min-w-full overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-bold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-6 py-4">Factura</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Reserva</th>
                <th className="px-6 py-4">Montos</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    No se encontraron facturas con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const client = profiles[inv.user_id] || { username: "Cargando...", phone: "Cargando..." };
                  const res = inv.reservations;
                  const isUpdating = updatingId === inv.id;

                  return (
                    <tr key={inv.id} className="hover:bg-zinc-50/55 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="font-extrabold text-zinc-900">{inv.invoice_number}</div>
                        <div className="text-2xs text-zinc-500 mt-0.5">
                          {new Date(inv.created_at).toLocaleDateString("es-CO")}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-zinc-900">{client.username}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{client.phone}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs">
                        {res ? (
                          <>
                            <div className="font-semibold text-zinc-800">
                              Cancha {res.court_id} - {res.date}
                            </div>
                            <div className="text-zinc-500 mt-0.5">
                              Hora: {String(res.hour).padStart(2, "0")}:00
                            </div>
                            {res.wompi_transaction_id && (
                              <div className="mt-1 font-mono text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded max-w-[120px] truncate" title={res.wompi_transaction_id}>
                                Tx: {res.wompi_transaction_id}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-red-500">Sin Reserva Asociada</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-xs text-zinc-600">
                          Total: <span className="font-bold">{formatCOP(inv.amount_total)}</span>
                        </div>
                        <div className="text-xs text-green-700 mt-0.5">
                          Abonado: <span className="font-bold">{formatCOP(inv.amount_paid)}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase ${
                            inv.payment_status === "paid"
                              ? "bg-green-100 text-green-800"
                              : inv.payment_status === "partially_paid"
                              ? "bg-blue-100 text-blue-800"
                              : inv.payment_status === "cancelled"
                              ? "bg-zinc-100 text-zinc-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {inv.payment_status === "paid"
                            ? "Pagado"
                            : inv.payment_status === "partially_paid"
                            ? "Anticipo Pagado"
                            : inv.payment_status === "cancelled"
                            ? "Anulado"
                            : "Pendiente"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-xs">
                        <div className="flex justify-end gap-2">
                          <LinkButton
                            href={`/facturas/${inv.id}`}
                            variant="ghost"
                            className="border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-100 px-3 py-1.5 rounded-lg flex items-center gap-1"
                          >
                            <FiFileText /> Detalle
                          </LinkButton>
                          
                          {inv.payment_status !== "paid" && inv.payment_status !== "cancelled" && (
                            <Button
                              type="button"
                              onClick={() => markAsPaid(inv.id, inv.amount_total)}
                              disabled={isUpdating}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1"
                            >
                              <FiCheck /> Pagado
                            </Button>
                          )}

                          {inv.payment_status !== "cancelled" && (
                            <Button
                              type="button"
                              onClick={() => markAsCancelled(inv.id)}
                              disabled={isUpdating}
                              className="bg-zinc-100 border border-zinc-200 text-zinc-700 hover:bg-zinc-200 px-3 py-1.5 rounded-lg flex items-center gap-1"
                            >
                              <FiX /> Anular
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
