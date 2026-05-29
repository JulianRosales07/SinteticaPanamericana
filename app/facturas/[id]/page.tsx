"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { FiArrowLeft, FiPrinter, FiDownload, FiCheckCircle, FiLoader, FiAlertTriangle } from "react-icons/fi";
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
        // Traer factura y la reserva asociada
        const inv = await billingService.getInvoiceDetail(id);

        if (!inv) {
          setError("Factura no encontrada.");
          setLoading(false);
          return;
        }

        setInvoice(inv);

        // Traer el perfil del cliente
        const prof = await profileRepo.getProfile(inv.user_id);

        if (prof) {
          setProfile(prof);
        }
      } catch (err: any) {
        setError(err.message || "Error al cargar la factura");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadInvoiceData();
    }
  }, [id, billingService, profileRepo]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-3">
          <FiLoader className="animate-spin text-4xl text-secondary" />
          <span className="text-sm font-medium text-zinc-600">Cargando factura...</span>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="mx-auto max-w-md py-16 px-6 text-center">
        <FiAlertTriangle className="mx-auto text-5xl text-amber-500 mb-4" />
        <h2 className="text-xl font-bold">{error || "Factura no encontrada"}</h2>
        <Button onClick={() => router.back()} className="mt-6 mx-auto">
          <FiArrowLeft /> Volver atrás
        </Button>
      </div>
    );
  }

  const reservation = invoice.reservations;
  const pendingAmount = invoice.amount_total - invoice.amount_paid;

  return (
    <div className="min-h-screen bg-zinc-100 py-12 px-6 print:bg-white print:py-0 print:px-0">
      <div className="mx-auto max-w-3xl">
        {/* Navigation & Action buttons - hidden on print */}
        <div className="mb-6 flex items-center justify-between print:hidden">
          <button
            onClick={() => router.back()}
            className="group inline-flex items-center gap-1 text-sm font-semibold text-secondary hover:underline"
          >
            <FiArrowLeft className="transition-transform group-hover:-translate-x-0.5" /> Volver
          </button>
          <div className="flex gap-2">
            <Button
              onClick={handlePrint}
              className="border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
            >
              <FiPrinter /> Imprimir / Descargar PDF
            </Button>
          </div>
        </div>

        {/* Invoice Card */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 md:p-12 shadow-soft print:border-none print:shadow-none print:p-0">
          {/* Invoice Header */}
          <div className="flex flex-col gap-6 md:flex-row md:justify-between border-b border-zinc-100 pb-8">
            <div>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-600 font-black text-white text-lg mb-4">
                CS
              </span>
              <h2 className="text-2xl font-black tracking-tight text-zinc-900">Cancha Sintética CS</h2>
              <p className="text-xs text-zinc-500 mt-1">Nit: 123456789-0</p>
              <p className="text-xs text-zinc-500">Dirección: Barrio El Recreo, Canchas Sintéticas CS</p>
              <p className="text-xs text-zinc-500">Tel: {process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER || "3186025827"}</p>
            </div>

            <div className="text-left md:text-right space-y-1">
              <span className="inline-block px-3 py-1 bg-red-50 text-red-700 font-extrabold text-xs rounded-full uppercase">
                Factura de Venta
              </span>
              <h3 className="text-lg font-bold text-zinc-950 mt-2">{invoice.invoice_number}</h3>
              <p className="text-xs text-zinc-500">
                Fecha Emisión: {new Date(invoice.created_at).toLocaleString("es-CO", { dateStyle: "medium" })}
              </p>
              <p className="text-xs text-zinc-500">
                Estado Pago:{" "}
                <span className="font-bold text-zinc-800">
                  {invoice.payment_status === "paid"
                    ? "PAGADO"
                    : invoice.payment_status === "partially_paid"
                    ? "ANTICIPO ABONADO"
                    : invoice.payment_status === "cancelled"
                    ? "ANULADO"
                    : "PENDIENTE"}
                </span>
              </p>
            </div>
          </div>

          {/* Client Details */}
          <div className="py-8 border-b border-zinc-100 grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Facturado a:</h4>
              <p className="font-extrabold text-zinc-900 mt-1">{profile?.username || "Usuario General"}</p>
              <p className="text-xs text-zinc-600 mt-0.5">Teléfono: {profile?.phone || "No especificado"}</p>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Detalles de la Reserva:</h4>
              <p className="font-extrabold text-zinc-900 mt-1">Cancha {reservation?.court_id}</p>
              <p className="text-xs text-zinc-600 mt-0.5">Fecha: {reservation?.date}</p>
              <p className="text-xs text-zinc-600">Hora: {String(reservation?.hour).padStart(2, "0")}:00</p>
              {reservation?.wompi_transaction_id && (
                <div className="mt-2 p-2 bg-zinc-50 rounded-xl border border-zinc-200">
                  <span className="block text-2xs font-extrabold uppercase text-zinc-500 tracking-wider">ID Transacción (Wompi)</span>
                  <span className="font-mono text-xs font-bold text-zinc-800 break-all">{reservation.wompi_transaction_id}</span>
                </div>
              )}
            </div>
          </div>

          {/* Details Table */}
          <div className="py-8">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  <th className="py-3">Descripción</th>
                  <th className="py-3 text-right">Cantidad</th>
                  <th className="py-3 text-right">Precio Unitario</th>
                  <th className="py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                <tr>
                  <td className="py-4">
                    <p className="font-bold text-zinc-900">Alquiler de Cancha Sintética (1 hora)</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Cancha {reservation?.court_id} - {reservation?.date} @ {String(reservation?.hour).padStart(2, "0")}:00
                    </p>
                  </td>
                  <td className="py-4 text-right">1</td>
                  <td className="py-4 text-right">{formatCOP(invoice.amount_total)}</td>
                  <td className="py-4 text-right font-bold text-zinc-950">{formatCOP(invoice.amount_total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="border-t border-zinc-200 pt-8 flex justify-end">
            <div className="w-full md:w-64 space-y-3 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal</span>
                <span>{formatCOP(invoice.amount_total)}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Total Impuestos (0%)</span>
                <span>$0</span>
              </div>
              <div className="flex justify-between font-bold text-zinc-900 border-b border-zinc-100 pb-3">
                <span>Total</span>
                <span>{formatCOP(invoice.amount_total)}</span>
              </div>
              <div className="flex justify-between text-green-700 font-bold">
                <span>Monto Abonado</span>
                <span>{formatCOP(invoice.amount_paid)}</span>
              </div>
              <div className="flex justify-between text-zinc-900 font-extrabold text-base bg-zinc-50 p-2.5 rounded-xl border border-zinc-100">
                <span>Saldo Pendiente</span>
                <span>{formatCOP(pendingAmount)}</span>
              </div>
            </div>
          </div>

          {/* Invoice Footer */}
          <div className="mt-12 border-t border-zinc-100 pt-8 text-center text-xs text-zinc-500 space-y-1">
            <p className="font-bold text-zinc-700">¡Gracias por tu confianza y preferencia!</p>
            <p>Esta factura fue generada electrónicamente por el sistema de reservas CS.</p>
            <p>Si tienes alguna inquietud, contáctanos a través de nuestros canales oficiales.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
