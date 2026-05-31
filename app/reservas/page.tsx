"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiCalendar, FiClock, FiActivity, FiArrowLeft, FiLoader, FiCheckCircle, FiFileText, FiXCircle, FiCreditCard, FiAlertTriangle } from "react-icons/fi";
import { Button, LinkButton } from "../../components/Button";
import { useReservations } from "../../hooks/useReservations";

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function canCancelReservation(res: any): { allowed: boolean; reason?: string } {
  if (!["active", "pending_payment"].includes(res.status)) {
    return { allowed: false, reason: "Esta reserva ya no se puede cancelar." };
  }
  const reservationDateTime = new Date(`${res.date}T${String(res.hour).padStart(2, "0")}:00:00`);
  const now = new Date();
  const hoursUntil = (reservationDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntil < 24) {
    return { allowed: false, reason: "No se puede cancelar con menos de 24h de antelación." };
  }
  return { allowed: true };
}

export default function MisReservasPage() {
  const router = useRouter();
  const { reservations, loading, activeTab, setActiveTab, reload } = useReservations();
  const [cancelModal, setCancelModal] = useState<{ open: boolean; reservation: any | null }>({ open: false, reservation: null });
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelResult, setCancelResult] = useState<{ success: boolean; message: string } | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  async function handleVerifyPayment(reservationId: string) {
    setVerifyingId(reservationId);
    try {
      const res = await fetch("/api/reservations/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId }),
      });
      const json = await res.json();
      if (json.success || json.status === "APPROVED") {
        reload();
      } else {
        alert(json.message ?? "No se pudo verificar el pago.");
      }
    } catch (e: any) {
      alert("Error verificando el pago: " + (e?.message ?? ""));
    }
    setVerifyingId(null);
  }

  async function handleCancel() {
    if (!cancelModal.reservation) return;
    setCancelLoading(true);
    setCancelResult(null);

    try {
      const res = await fetch("/api/reservations/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: cancelModal.reservation.id }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        const refundMsg = json.refund?.attempted
          ? json.refund.message
          : "Tu reserva ha sido cancelada y el horario fue liberado.";
        setCancelResult({ success: true, message: refundMsg });
        reload();
      } else {
        setCancelResult({ success: false, message: json.error ?? "Error al cancelar la reserva." });
      }
    } catch (e: any) {
      setCancelResult({ success: false, message: e?.message ?? "Error de conexión." });
    }
    setCancelLoading(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-3">
          <FiLoader className="animate-spin text-4xl text-secondary" />
          <span className="text-sm font-medium text-zinc-600">Cargando tus reservas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-zinc-50 to-zinc-100 pt-28 pb-12 px-6">
      <div className="mx-auto max-w-4xl">
        {/* Navigation & Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              onClick={() => router.push("/perfil")}
              className="group mb-2 inline-flex items-center gap-1 text-sm font-semibold text-secondary hover:underline"
            >
              <FiArrowLeft className="transition-transform group-hover:-translate-x-0.5" /> Volver a mi perfil
            </button>
            <h1 className="text-3xl font-black tracking-tight text-on-background">Mis Reservas</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Consulta el estado de tus alquileres de cancha y facturas asociadas.
            </p>
          </div>
          <LinkButton href="/reservar" variant="primary">
            <FiCalendar /> Reservar cancha
          </LinkButton>
        </div>

        {/* Tab Selection */}
        <div className="mb-6 flex gap-2 border-b border-zinc-200 pb-px">
          <button
            onClick={() => setActiveTab("active")}
            className={`pb-3 text-sm font-bold border-b-2 transition-all px-4 ${
              activeTab === "active"
                ? "border-secondary text-secondary"
                : "border-transparent text-zinc-500 hover:text-zinc-950"
            }`}
          >
            Reservas Activas
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`pb-3 text-sm font-bold border-b-2 transition-all px-4 ${
              activeTab === "all"
                ? "border-secondary text-secondary"
                : "border-transparent text-zinc-500 hover:text-zinc-950"
            }`}
          >
            Historial Completo
          </button>
        </div>

        {/* Grid List */}
        {reservations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-white/50 py-16 px-6 text-center">
            <FiActivity className="mx-auto text-4xl text-zinc-300 mb-4" />
            <h3 className="text-lg font-bold text-zinc-700">Sin reservas</h3>
            <p className="mt-2 text-sm text-zinc-500 max-w-sm mx-auto">
              {activeTab === "active"
                ? "No tienes reservas activas programadas a partir de hoy."
                : "No has realizado ninguna reserva en la plataforma."}
            </p>
            <LinkButton href="/reservar" variant="secondary" className="mt-6">
              Hacer mi primera reserva
            </LinkButton>
          </div>
        ) : (
          <div className="grid gap-6">
            {reservations.map((res) => {
              const invoice = Array.isArray(res.invoices) ? res.invoices[0] : res.invoices;
              const cancelCheck = canCancelReservation(res);

              return (
                <div
                  key={res.id}
                  className={`rounded-3xl border bg-white p-6 shadow-soft hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 ${
                    res.status === "cancelled" ? "border-zinc-200 opacity-75" : "border-zinc-200"
                  }`}
                >
                  <div className="flex-1 space-y-4">
                    {/* Court and date info */}
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-zinc-100 font-bold text-zinc-800 text-sm">
                        C{res.court_id}
                      </span>
                      <div>
                        <h3 className="font-extrabold text-lg text-zinc-900">Cancha {res.court_id}</h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600 mt-0.5">
                          <span className="flex items-center gap-1">
                            <FiCalendar className="text-zinc-400" /> {res.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <FiClock className="text-zinc-400" /> {String(res.hour).padStart(2, "0")}:00
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pricing, Payment & Booking details */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-zinc-100 pt-4 text-xs">
                      <div>
                        <span className="block text-zinc-500 font-semibold uppercase tracking-wider">Precio Total</span>
                        <span className="font-bold text-sm text-zinc-900">{formatCOP(res.price_cop)}</span>
                      </div>
                      <div>
                        <span className="block text-zinc-500 font-semibold uppercase tracking-wider">Estado Reserva</span>
                        {res.status === "cancelled" ? (
                          <span className="inline-flex items-center gap-1 font-bold text-red-700 mt-1">
                            <FiXCircle /> Cancelada
                          </span>
                        ) : res.status === "pending_payment" ? (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-700 mt-1">
                            <FiCreditCard /> Pendiente Pago
                          </span>
                        ) : res.confirmed ? (
                          <span className="inline-flex items-center gap-1 font-bold text-green-700 mt-1">
                            <FiCheckCircle /> Confirmada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-blue-700 mt-1">
                            <FiCheckCircle /> Activa (Anticipo pagado)
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="block text-zinc-500 font-semibold uppercase tracking-wider">Estado Pago</span>
                        {invoice ? (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase mt-1 ${
                              invoice.payment_status === "paid"
                                ? "bg-green-100 text-green-800"
                                : invoice.payment_status === "partially_paid"
                                ? "bg-blue-100 text-blue-800"
                                : invoice.payment_status === "cancelled"
                                ? "bg-zinc-100 text-zinc-700"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {invoice.payment_status === "paid"
                              ? "Pagado"
                              : invoice.payment_status === "partially_paid"
                              ? "Anticipo Pagado"
                              : invoice.payment_status === "cancelled"
                              ? "Anulado"
                              : "Pendiente"}
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase mt-1 bg-amber-100 text-amber-800">
                            Pendiente Pago
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 min-w-[150px] border-t md:border-t-0 border-zinc-100 pt-4 md:pt-0">
                    {invoice && (
                      <LinkButton
                        href={`/facturas/${invoice.id}`}
                        variant="secondary"
                        className="w-full justify-center text-center text-xs"
                      >
                        <FiFileText /> Ver Factura
                      </LinkButton>
                    )}

                    {res.status !== "cancelled" && (res.status === "pending_payment" || !res.deposit_paid) && !invoice && (
                      <>
                        <Button
                          type="button"
                          onClick={async () => {
                            try {
                              const resCheckout = await fetch(
                                `/api/wompi/checkout-url?reservationId=${encodeURIComponent(res.id)}`,
                                { cache: "no-store" }
                              );
                              const json = await resCheckout.json();
                              if (resCheckout.ok && json.url) {
                                window.location.href = json.url;
                              }
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className="w-full text-xs justify-center"
                        >
                          <FiCreditCard /> Pagar Anticipo
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleVerifyPayment(res.id)}
                          disabled={verifyingId === res.id}
                          className="w-full text-xs font-bold text-blue-600 border border-blue-200 rounded-xl px-3 py-2 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {verifyingId === res.id ? (
                            <><FiLoader className="animate-spin" /> Verificando...</>
                          ) : (
                            <><FiCheckCircle /> Verificar Pago</>
                          )}
                        </button>
                      </>
                    )}

                    {/* Cancel Button */}
                    {cancelCheck.allowed && (
                      <button
                        type="button"
                        onClick={() => setCancelModal({ open: true, reservation: res })}
                        className="w-full text-xs font-bold text-red-600 border border-red-200 rounded-xl px-3 py-2 hover:bg-red-50 transition-colors flex items-center justify-center gap-1"
                      >
                        <FiXCircle /> Cancelar Reserva
                      </button>
                    )}

                    {!cancelCheck.allowed && res.status !== "cancelled" && (
                      <p className="text-[10px] text-zinc-400 text-center mt-1">{cancelCheck.reason}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelModal.open && cancelModal.reservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
            {cancelResult ? (
              <>
                <div className={`flex items-center gap-3 ${cancelResult.success ? "text-green-700" : "text-red-700"}`}>
                  {cancelResult.success ? (
                    <FiCheckCircle className="text-2xl shrink-0" />
                  ) : (
                    <FiXCircle className="text-2xl shrink-0" />
                  )}
                  <h3 className="text-lg font-bold">
                    {cancelResult.success ? "Reserva Cancelada" : "Error"}
                  </h3>
                </div>
                <p className="text-sm text-zinc-600">{cancelResult.message}</p>
                <button
                  onClick={() => {
                    setCancelModal({ open: false, reservation: null });
                    setCancelResult(null);
                  }}
                  className="w-full bg-zinc-900 text-white font-bold py-3 rounded-xl hover:bg-zinc-800 transition-colors"
                >
                  Cerrar
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 text-amber-600">
                  <FiAlertTriangle className="text-2xl shrink-0" />
                  <h3 className="text-lg font-bold text-zinc-900">¿Cancelar esta reserva?</h3>
                </div>

                <div className="bg-zinc-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Cancha</span>
                    <span className="font-bold">Cancha {cancelModal.reservation.court_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Fecha</span>
                    <span className="font-bold">{cancelModal.reservation.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Hora</span>
                    <span className="font-bold">{String(cancelModal.reservation.hour).padStart(2, "0")}:00</span>
                  </div>
                </div>

                {cancelModal.reservation.deposit_paid && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                    <strong>Reembolso automático:</strong> Se intentará devolver el anticipo ({formatCOP(cancelModal.reservation.deposit_cop ?? 0)}) a tu método de pago original.
                  </div>
                )}

                <p className="text-xs text-zinc-500">
                  Esta acción liberará el horario para que otros usuarios puedan reservarlo. No se puede deshacer.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setCancelModal({ open: false, reservation: null });
                      setCancelResult(null);
                    }}
                    disabled={cancelLoading}
                    className="flex-1 bg-zinc-100 text-zinc-700 font-bold py-3 rounded-xl hover:bg-zinc-200 transition-colors"
                  >
                    Volver
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={cancelLoading}
                    className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {cancelLoading ? (
                      <>
                        <FiLoader className="animate-spin" /> Procesando...
                      </>
                    ) : (
                      <>
                        <FiXCircle /> Confirmar Cancelación
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
