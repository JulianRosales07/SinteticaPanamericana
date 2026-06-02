"use client";

import { useEffect, useMemo, useState } from "react";
import { FiLoader, FiSave } from "react-icons/fi";
import { Button } from "../../../components/Button";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

type PaymentSettingsRow = {
  id: number;
  deposit_percent: number;
};

export default function AdminPagosPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [row, setRow] = useState<PaymentSettingsRow | null>(null);
  const [deposit, setDeposit] = useState<string>("30");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    setOk(null);

    const { data, error } = await supabase
      .from("payment_settings")
      .select("id, deposit_percent")
      .eq("id", 1)
      .maybeSingle();

    if (error) setError(error.message);
    if (data) {
      setRow(data as PaymentSettingsRow);
      setDeposit(String((data as PaymentSettingsRow).deposit_percent));
    } else {
      setRow(null);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setError(null);
    setOk(null);
    const n = Number(deposit);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      setError("El porcentaje debe estar entre 0 y 100.");
      return;
    }

    const { data, error } = row
      ? await supabase
          .from("payment_settings")
          .update({ deposit_percent: n, updated_at: new Date().toISOString() })
          .eq("id", 1)
          .select("id, deposit_percent")
          .single()
      : await supabase
          .from("payment_settings")
          .insert({ id: 1, deposit_percent: n })
          .select("id, deposit_percent")
          .single();

    if (error) {
      setError(error.message);
      return;
    }
    setRow(data as PaymentSettingsRow);
    setOk("Guardado.");
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
        <h2 className="text-2xl font-black tracking-tight">Configuración de Abonos</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Configura el porcentaje de anticipo requerido para separar las canchas.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {ok && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {ok}
        </div>
      )}

      <div className="rounded-3xl border border-zinc-200 bg-white p-6">
        <label className="text-sm font-semibold">Porcentaje de anticipo</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="number"
            min={0}
            max={100}
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none sm:w-48"
          />
          <div className="text-sm text-zinc-600">% del valor de la reserva</div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" onClick={load} className="border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100">
            Recargar
          </Button>
          <Button type="button" onClick={save}>
            <FiSave /> Guardar
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-700">
        <div className="font-semibold">Notas</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-600">
          <li>
            El abono requerido se calcula automáticamente sobre el valor de la reserva según la tarifa vigente.
          </li>
          <li>
            Al registrarse la reserva, el abono queda inicialmente en estado no confirmado hasta que el administrador lo valide manualmente.
          </li>
        </ul>
      </div>
    </div>
  );
}

