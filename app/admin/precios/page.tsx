"use client";

import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiDollarSign, FiLoader, FiMoon, FiSave, FiSun } from "react-icons/fi";
import { Button } from "../../../components/Button";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

type PricingRow = {
  id: number;
  court_id: number;
  start_hour: number;
  end_hour: number;
  price_cop: number;
  active: boolean;
};

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AdminPreciosPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Precios locales de mañana y noche para cancha 1 y 2
  const [c1Morning, setC1Morning] = useState<number>(80000);
  const [c1Evening, setC1Evening] = useState<number>(100000);
  const [c2Morning, setC2Morning] = useState<number>(80000);
  const [c2Evening, setC2Evening] = useState<number>(100000);

  // Estado de carga por cancha al guardar
  const [savingC1, setSavingC1] = useState(false);
  const [savingC2, setSavingC2] = useState(false);

  async function load() {
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    const { data, error: rErr } = await supabase
      .from("pricing_rules")
      .select("id, court_id, start_hour, end_hour, price_cop, active")
      .eq("active", true);

    if (rErr) {
      setError(rErr.message);
      setIsLoading(false);
      return;
    }

    const rules = (data ?? []) as PricingRow[];

    // Buscar regla de mañana (6-17) y noche (18-23) para Cancha 1
    const c1M = rules.find((r) => r.court_id === 1 && r.start_hour === 6 && r.end_hour === 17);
    const c1E = rules.find((r) => r.court_id === 1 && r.start_hour === 18 && r.end_hour === 23);

    // Buscar regla de mañana (6-17) y noche (18-23) para Cancha 2
    const c2M = rules.find((r) => r.court_id === 2 && r.start_hour === 6 && r.end_hour === 17);
    const c2E = rules.find((r) => r.court_id === 2 && r.start_hour === 18 && r.end_hour === 23);

    if (c1M) setC1Morning(c1M.price_cop);
    if (c1E) setC1Evening(c1E.price_cop);
    if (c2M) setC2Morning(c2M.price_cop);
    if (c2E) setC2Evening(c2E.price_cop);

    setIsLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveCourtPrices(courtId: number, morningPrice: number, eveningPrice: number) {
    setError(null);
    setSuccessMsg(null);
    if (courtId === 1) setSavingC1(true);
    else setSavingC2(true);

    try {
      // 1. Obtener todas las reglas (activas e inactivas) para esta cancha para gestionarlas
      const { data: existingRules, error: fetchErr } = await supabase
        .from("pricing_rules")
        .select("id, start_hour, end_hour, active")
        .eq("court_id", courtId);

      if (fetchErr) throw fetchErr;

      const rules = existingRules ?? [];
      const morningRules = rules.filter((r) => r.start_hour === 6 && r.end_hour === 17);
      const eveningRules = rules.filter((r) => r.start_hour === 18 && r.end_hour === 23);

      // --- CANALIZAR MAÑANA ---
      if (morningRules.length > 0) {
        // Actualizar la primera regla a activa con el nuevo precio
        const { error: uErr } = await supabase
          .from("pricing_rules")
          .update({ price_cop: morningPrice, active: true })
          .eq("id", morningRules[0].id);

        if (uErr) throw uErr;

        // Eliminar duplicadas si existen
        if (morningRules.length > 1) {
          const idsToDelete = morningRules.slice(1).map((r) => r.id);
          await supabase.from("pricing_rules").delete().in("id", idsToDelete);
        }
      } else {
        // Crear la regla si no existe
        const { error: iErr } = await supabase.from("pricing_rules").insert({
          court_id: courtId,
          start_hour: 6,
          end_hour: 17,
          price_cop: morningPrice,
          active: true,
        });
        if (iErr) throw iErr;
      }

      // --- CANALIZAR NOCHE ---
      if (eveningRules.length > 0) {
        // Actualizar la primera regla a activa con el nuevo precio
        const { error: uErr } = await supabase
          .from("pricing_rules")
          .update({ price_cop: eveningPrice, active: true })
          .eq("id", eveningRules[0].id);

        if (uErr) throw uErr;

        // Eliminar duplicadas si existen
        if (eveningRules.length > 1) {
          const idsToDelete = eveningRules.slice(1).map((r) => r.id);
          await supabase.from("pricing_rules").delete().in("id", idsToDelete);
        }
      } else {
        // Crear la regla si no existe
        const { error: iErr } = await supabase.from("pricing_rules").insert({
          court_id: courtId,
          start_hour: 18,
          end_hour: 23,
          price_cop: eveningPrice,
          active: true,
        });
        if (iErr) throw iErr;
      }

      // Opcional: Eliminar cualquier otra regla que no sea de las horas estándar para mantener la BD limpia
      const otherRules = rules.filter(
        (r) =>
          !(r.start_hour === 6 && r.end_hour === 17) &&
          !(r.start_hour === 18 && r.end_hour === 23)
      );
      if (otherRules.length > 0) {
        const idsToDelete = otherRules.map((r) => r.id);
        await supabase.from("pricing_rules").delete().in("id", idsToDelete);
      }

      setSuccessMsg(`Precios de la Cancha ${courtId} actualizados con éxito.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || "Ocurrió un error al guardar los precios.");
    } finally {
      if (courtId === 1) setSavingC1(false);
      else setSavingC2(false);
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
        <h2 className="text-2xl font-black tracking-tight">Tarifas y Precios</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Configura de forma directa las tarifas de Mañana (06:00 - 17:59) y Noche (18:00 - 23:59) para cada cancha.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <FiCheck className="text-lg" />
          {successMsg}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* TARJETA CANCHA 1 */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-6">
              <div className="text-xl font-extrabold tracking-tight">Cancha 1</div>
              <span className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-bold text-red-700">
                Tarifa Activa
              </span>
            </div>

            <div className="space-y-4">
              {/* Tarifa Mañana */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">
                  <FiSun className="text-amber-500 text-sm" /> Tarifa Mañana (06:00 - 17:59)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-500 font-semibold">
                    COP
                  </div>
                  <input
                    type="number"
                    value={c1Morning}
                    onChange={(e) => setC1Morning(Number(e.target.value))}
                    className="appearance-none w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-16 pr-4 text-base font-semibold text-zinc-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 m-0 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="80000"
                  />
                </div>
                <div className="mt-1 pl-1 text-xs text-zinc-500 font-medium">
                  Visualización: <span className="font-semibold text-zinc-700">{formatCOP(c1Morning)}</span>
                </div>
              </div>

              {/* Tarifa Noche */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">
                  <FiMoon className="text-indigo-500 text-sm" /> Tarifa Noche (18:00 - 23:59)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-500 font-semibold">
                    COP
                  </div>
                  <input
                    type="number"
                    value={c1Evening}
                    onChange={(e) => setC1Evening(Number(e.target.value))}
                    className="appearance-none w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-16 pr-4 text-base font-semibold text-zinc-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 m-0 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="100000"
                  />
                </div>
                <div className="mt-1 pl-1 text-xs text-zinc-500 font-medium">
                  Visualización: <span className="font-semibold text-zinc-700">{formatCOP(c1Evening)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Button
              type="button"
              className="w-full justify-center gap-2 py-3.5 text-sm"
              onClick={() => saveCourtPrices(1, c1Morning, c1Evening)}
              disabled={savingC1}
            >
              {savingC1 ? (
                <>
                  <FiLoader className="animate-spin text-base" /> Guardando...
                </>
              ) : (
                <>
                  <FiSave className="text-base" /> Guardar Cancha 1
                </>
              )}
            </Button>
          </div>
        </div>

        {/* TARJETA CANCHA 2 */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-6">
              <div className="text-xl font-extrabold tracking-tight">Cancha 2</div>
              <span className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-bold text-red-700">
                Tarifa Activa
              </span>
            </div>

            <div className="space-y-4">
              {/* Tarifa Mañana */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">
                  <FiSun className="text-amber-500 text-sm" /> Tarifa Mañana (06:00 - 17:59)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-500 font-semibold">
                    COP
                  </div>
                  <input
                    type="number"
                    value={c2Morning}
                    onChange={(e) => setC2Morning(Number(e.target.value))}
                    className="appearance-none w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-16 pr-4 text-base font-semibold text-zinc-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 m-0 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="80000"
                  />
                </div>
                <div className="mt-1 pl-1 text-xs text-zinc-500 font-medium">
                  Visualización: <span className="font-semibold text-zinc-700">{formatCOP(c2Morning)}</span>
                </div>
              </div>

              {/* Tarifa Noche */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">
                  <FiMoon className="text-indigo-500 text-sm" /> Tarifa Noche (18:00 - 23:59)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-500 font-semibold">
                    COP
                  </div>
                  <input
                    type="number"
                    value={c2Evening}
                    onChange={(e) => setC2Evening(Number(e.target.value))}
                    className="appearance-none w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-16 pr-4 text-base font-semibold text-zinc-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 m-0 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="100000"
                  />
                </div>
                <div className="mt-1 pl-1 text-xs text-zinc-500 font-medium">
                  Visualización: <span className="font-semibold text-zinc-700">{formatCOP(c2Evening)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Button
              type="button"
              className="w-full justify-center gap-2 py-3.5 text-sm"
              onClick={() => saveCourtPrices(2, c2Morning, c2Evening)}
              disabled={savingC2}
            >
              {savingC2 ? (
                <>
                  <FiLoader className="animate-spin text-base" /> Guardando...
                </>
              ) : (
                <>
                  <FiSave className="text-base" /> Guardar Cancha 2
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
