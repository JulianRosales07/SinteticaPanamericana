"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { FiArrowLeft, FiPrinter, FiCheckCircle, FiLoader, FiAlertTriangle } from "react-icons/fi";
import { Button } from "../../../components/Button";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { BillingService, ProfileRepository } from "../../../lib/core";

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [invoice, setInvoice] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const billingService = useMemo(() => new BillingService(supabase), [supabase]);
  const profileRepo = useMemo(() => new ProfileRepository(supabase), [supabase]);

  useEffect(() => {
    async function loadInvoiceData() {
      setLoading(true);
      setError(null);

      try {
        const inv = await billingService.getInvoiceDetail(id);
        if (!inv) {
          setError("Factura no encontrada.");
          setLoading(false);
          return;
        }
        setInvoice(inv);

        const prof = await profileRepo.getProfile(inv.user_id);
        if (prof) setProfile(prof);
      } catch (err: any) {
        setError(err.message || "Error al cargar la factura");
      } finally {
        setLoading(false);
      }
    }

    if (id) loadInvoiceData();
  }, [id, billingService, profileRepo]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <FiLoader className="animate-spin text-3xl text-primary" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="mx-auto max-w-md py-16 px-6 text-center">
        <FiAlertTriangle className="mx-auto text-5xl text-amber-500 mb-4" />
        <h2 className="text-lg font-bold">{error || "Factura no encontrada"}</h2>
        <Button onClick={() => router.back()} className="mt-6 mx-auto">
          <FiArrowLeft /> Volver
        </Button>
      </div>
    );
  }

  const reservation = invoice.reservations;
  const pendingAmount = invoice.amount_total - invoice.amount_paid;
  const isPaid = invoice.payment_status === "paid";
  const isCancelled = invoice.payment_status === "cancelled";

  const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
    paid: { label: "Pagado", cls: "bg-green-100 text-green-700 border-green-200", icon: "check_circle" },
    partially_paid: { label: "Anticipo Abonado", cls: "bg-blue-100 text-blue-700 border-blue-200", icon: "schedule" },
    cancelled: { label: "Anulada", cls: "bg-zinc-100 text-zinc-600 border-zinc-200", icon: "cancel" },
    pending: { label: "Pendiente de Pago", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: "pending" },
  };
  const status = statusConfig[invoice.payment_status] || statusConfig.pending;

  return (
    <div className="min-h-screen bg-surface pt-20 py-6 px-4 lg:pt-24 lg:py-12 lg:px-6 print:bg-white print:py-0 print:px-0 print:pt-0">
      <div className="mx-auto max-w-2xl">
        {/* Top bar - hidden on print */}
        <div className="mb-4 flex items-center justify-between print:hidden">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/admin/facturas");
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-outline-variant/40 rounded-lg text-sm font-bold text-on-surface hover:bg-surface-container transition-colors"
          >
            <FiArrowLeft /> Volver a facturas
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-outline-variant/40 rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container transition-colors"
          >
            <FiPrinter /> Imprimir
          </button>
        </div>

        {/* Invoice Card */}
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
          {/* Status Banner */}
          <div className={`px-4 py-3 flex items-center gap-2 border-b ${status.cls}`}>
            <span className="material-symbols-outlined text-lg">{status.icon}</span>
            <span className="text-sm font-bold">{status.label}</span>
            <span className="ml-auto text-xs font-semibold opacity-70">
              {invoice.invoice_number}
            </span>
          </div>

          {/* Header */}
          <div className="px-4 py-5 sm:px-6 border-b border-outline-variant/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg text-on-primary-container">sports_soccer</span>
                  </div>
                  <span className="text-sm font-black text-on-surface">Sintéticas Panamericana</span>
                </div>
                <p className="text-[11px] text-on-surface-variant">Sistema de Reservas</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-on-surface">{invoice.invoice_number}</p>
                <p className="text-[11px] text-on-surface-variant">
                  {new Date(invoice.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            </div>
          </div>

          {/* Client + Reservation */}
          <div className="px-4 py-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-outline-variant/20">
            <div>
              <p className="text-[10px] uppercase font-bold text-outline tracking-wider mb-1">Cliente</p>
              <p className="text-sm font-bold text-on-surface">{profile?.username || "Usuario"}</p>
              <p className="text-xs text-on-surface-variant">{profile?.phone || "Sin teléfono"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-outline tracking-wider mb-1">Reserva</p>
              {reservation ? (
                <>
                  <p className="text-sm font-bold text-on-surface">Cancha {reservation.court_id}</p>
                  <p className="text-xs text-on-surface-variant">
                    {reservation.date} • {String(reservation.hour).padStart(2, "0")}:00
                  </p>
                </>
              ) : (
                <p className="text-xs text-red-500 italic">Sin reserva asociada</p>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="px-4 py-4 sm:px-6 border-b border-outline-variant/20">
            <p className="text-[10px] uppercase font-bold text-outline tracking-wider mb-3">Detalle</p>
            <div className="bg-surface-container-low rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface">Alquiler Cancha Sintética</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    1 hora • Cancha {reservation?.court_id} • {reservation?.date} @ {String(reservation?.hour ?? 0).padStart(2, "0")}:00
                  </p>
                </div>
                <p className="text-sm font-bold text-on-surface shrink-0">{formatCOP(invoice.amount_total)}</p>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="px-4 py-4 sm:px-6 space-y-2">
            <div className="flex justify-between text-sm text-on-surface-variant">
              <span>Subtotal</span>
              <span>{formatCOP(invoice.amount_total)}</span>
            </div>
            <div className="flex justify-between text-sm text-on-surface-variant">
              <span>Impuestos (0%)</span>
              <span>$0</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-on-surface pt-2 border-t border-outline-variant/20">
              <span>Total</span>
              <span>{formatCOP(invoice.amount_total)}</span>
            </div>

            {invoice.amount_paid > 0 && (
              <div className="flex justify-between text-sm font-bold text-green-700 pt-1">
                <span className="flex items-center gap-1">
                  <FiCheckCircle className="text-xs" /> Abonado
                </span>
                <span>{formatCOP(invoice.amount_paid)}</span>
              </div>
            )}

            {!isPaid && !isCancelled && (
              <div className="flex justify-between items-center mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <span className="text-sm font-bold text-amber-800">Saldo Pendiente</span>
                <span className="text-lg font-black text-amber-800">{formatCOP(pendingAmount)}</span>
              </div>
            )}

            {isPaid && (
              <div className="flex justify-between items-center mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                <span className="text-sm font-bold text-green-700 flex items-center gap-1">
                  <FiCheckCircle /> Pagado completo
                </span>
                <span className="text-lg font-black text-green-700">{formatCOP(invoice.amount_total)}</span>
              </div>
            )}
          </div>




          {/* Footer */}
          <div className="px-4 py-4 sm:px-6 bg-surface-container-low border-t border-outline-variant/20 text-center">
            <p className="text-xs font-semibold text-on-surface-variant">¡Gracias por tu preferencia!</p>
            <p className="text-[10px] text-outline mt-0.5">Factura generada por Sintéticas Panamericana</p>
          </div>
        </div>
      </div>
    </div>
  );
}
