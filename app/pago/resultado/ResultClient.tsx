"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FiCheckCircle, FiLoader, FiXCircle } from "react-icons/fi";
import { LinkButton } from "../../../components/Button";

type TxResponse = {
  data?: {
    id: string;
    status: "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR" | string;
    reference: string;
    amount_in_cents: number;
    currency: string;
  };
};

export default function ResultClient() {
  const sp = useSearchParams();
  const txId = sp.get("id"); // Wompi agrega ?id=<TRANSACTION_ID>
  const reservationId = sp.get("reservationId");

  const [tx, setTx] = useState<TxResponse["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      if (!txId) {
        setError("No llegó el id de transacción desde Wompi.");
        setIsLoading(false);
        return;
      }
      const res = await fetch(`/api/wompi/transaction?id=${encodeURIComponent(txId)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as TxResponse;
      if (!res.ok) {
        setError(json as any);
        setIsLoading(false);
        return;
      }
      setTx(json.data ?? null);
      setIsLoading(false);
    }
    load();
  }, [txId]);

  const status = tx?.status;
  const isApproved = status === "APPROVED";
  const isFinal =
    status && ["APPROVED", "DECLINED", "VOIDED", "ERROR"].includes(status);

  return (
    <div className="bg-white px-6 py-16">
      <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-black tracking-tight">Resultado del pago</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Aquí verás el estado del anticipo de tu reserva.
        </p>

        {isLoading ? (
          <div className="mt-10 flex items-center justify-center">
            <FiLoader className="animate-spin text-3xl text-red-700" />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {String(error)}
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div
              className={
                "flex items-center gap-2 text-lg font-extrabold " +
                (isApproved ? "text-green-700" : "text-zinc-800")
              }
            >
              {isApproved ? <FiCheckCircle /> : <FiXCircle />}
              Estado: {status ?? "—"}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Transacción</span>
                <span className="font-mono text-xs">{tx?.id ?? "—"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-semibold">Referencia</span>
                <span className="font-mono text-xs">{tx?.reference ?? "—"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-semibold">Valor</span>
                <span>
                  {tx?.currency ?? "COP"} {(tx?.amount_in_cents ?? 0) / 100}
                </span>
              </div>
            </div>

            {isApproved ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <strong>¡Reserva confirmada!</strong> Tu anticipo fue aprobado y tu cancha está reservada.
                El saldo restante se paga en taquilla el día del partido.
              </div>
            ) : isFinal ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <strong>Pago no aprobado.</strong> Tu reserva ha sido liberada. Puedes intentar reservar nuevamente.
              </div>
            ) : null}

            {!isFinal && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Tu pago aún está en proceso. Puedes esperar unos segundos y
                recargar esta página. La reserva se confirmará automáticamente cuando el pago sea aprobado.
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/reservar" variant="primary" className="w-full">
                Volver a reservar
              </LinkButton>
              <Link
                href={reservationId ? `/reservar` : "/"}
                className="w-full rounded-full border border-zinc-200 px-5 py-3 text-center text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Ir al inicio
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

