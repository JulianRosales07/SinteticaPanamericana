"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { FiCreditCard } from "react-icons/fi";
import { z } from "zod";
import { Button } from "../../components/Button";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { ProfileRepository, PricingService } from "../../lib/core";

const schema = z.object({
  cancha: z.union([z.literal(1), z.literal(2)]),
  date: z.string().min(10, "Selecciona una fecha"),
  hour: z.number().int().min(6).max(23),
});

type FormValues = z.infer<typeof schema>;

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ReservarPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [created, setCreated] = useState<any | null>(null);
  const [depositInfo, setDepositInfo] = useState<{ percent: number; cop: number } | null>(null);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [profilePhone, setProfilePhone] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [dbRules, setDbRules] = useState<any[]>([]);

  const profileRepo = useMemo(() => new ProfileRepository(supabase), [supabase]);
  const pricingService = useMemo(() => new PricingService(supabase), [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      setUserEmail(u?.email ?? null);
      if (!u) return;
      try {
        const profile = await profileRepo.getProfile(u.id);
        setProfileUsername(profile?.username ?? null);
        setProfilePhone(profile?.phone ?? null);
        setPhoneDraft(profile?.phone ?? "");
      } catch (e) {
        console.error("Error loading profile:", e);
      }
    });
    pricingService.loadRules().then(() => {
      setDbRules([...(pricingService as any).rules]);
    });
  }, [supabase, profileRepo, pricingService]);

  const hourOptions = useMemo(() => {
    const hours: number[] = [];
    for (let h = 6; h <= 23; h++) hours.push(h);
    return hours;
  }, []);

  const {
    register,
    watch,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cancha: 1,
      date: new Date().toISOString().slice(0, 10),
      hour: 18,
    },
  });

  const cancha = watch("cancha");
  const hour = watch("hour");

  const price = useMemo(() => {
    return pricingService.getPriceForHour(cancha, hour);
  }, [cancha, hour, dbRules, pricingService]);

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setFormError("Debes iniciar sesión para confirmar una reserva.");
      return;
    }
    if (!profilePhone) {
      setFormError("Antes de reservar debes registrar tu número de teléfono (WhatsApp).");
      return;
    }

    // 1) Crear reserva con status "pending_payment" (NO activa hasta que pague)
    const { data, error } = await supabase
      .from("reservations")
      .insert({
        user_id: user.id,
        created_by: profileUsername ?? user.email ?? "usuario",
        court_id: values.cancha,
        date: values.date,
        hour: values.hour,
        price_cop: price,
        status: "pending_payment",
      })
      .select()
      .single();

    if (error) {
      const code = (error as any).code as string | undefined;
      if (code === "23505") {
        setFormError("Esa hora ya está reservada para esa cancha. Elige otro horario.");
        return;
      }
      setFormError(error.message);
      return;
    }

    // 2) Redirigir inmediatamente al pago del anticipo (obligatorio)
    try {
      const res = await fetch(`/api/wompi/checkout-url?reservationId=${encodeURIComponent(data.id)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json?.error ?? "No se pudo generar el enlace de pago.");
        setCreated(data);
        return;
      }
      setDepositInfo({ percent: json.depositPercent, cop: json.depositCOP });
      // Redirigir al checkout de Wompi
      window.location.href = json.url;
    } catch (e: any) {
      setFormError(e?.message ?? "Error generando el pago. Puedes intentar pagar desde 'Mis Reservas'.");
      setCreated(data);
    }
  }

  return (
    <div className="min-h-screen bg-surface turf-accent pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        {created ? (
          /* ─── FALLBACK: Reserva creada pero no se pudo redirigir al pago ─── */
          <div className="max-w-lg mx-auto">
            <div className="glass-card rounded-2xl border border-outline-variant/30 p-8 shadow-xl">
              <div className="flex items-center gap-3 text-xl font-black text-amber-600 mb-4">
                <FiCreditCard className="text-2xl" /> Pago pendiente
              </div>
              <p className="text-sm text-on-surface-variant mb-6">
                Tu reserva fue registrada pero necesitas completar el pago del anticipo para confirmarla. 
                Si no pagas, el horario se liberará automáticamente.
              </p>
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between py-2 border-b border-outline-variant/20">
                  <span className="font-bold text-on-surface-variant text-sm">Cancha</span>
                  <span className="font-black text-on-surface">Cancha {created.court_id}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-outline-variant/20">
                  <span className="font-bold text-on-surface-variant text-sm">Fecha</span>
                  <span className="font-black text-on-surface">{created.date}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-outline-variant/20">
                  <span className="font-bold text-on-surface-variant text-sm">Hora</span>
                  <span className="font-black text-on-surface">{String(created.hour).padStart(2, "0")}:00</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="font-bold text-on-surface-variant text-sm">Precio</span>
                  <span className="text-xl font-black text-primary">{formatCOP(created.price_cop)}</span>
                </div>
              </div>

              {formError && (
                <div className="mb-4 rounded-lg border border-error/20 bg-error-container/20 p-3 text-sm text-error font-semibold">{formError}</div>
              )}

              {/* Botón para reintentar el pago */}
              <Button
                type="button"
                className="w-full bg-primary hover:bg-primary/90 text-on-primary font-bold py-3 shadow-lg"
                onClick={async () => {
                  setFormError(null);
                  try {
                    const res = await fetch(`/api/wompi/checkout-url?reservationId=${encodeURIComponent(created.id)}`, { cache: "no-store" });
                    const json = await res.json();
                    if (!res.ok) { setFormError(json?.error ?? "No se pudo generar el pago."); return; }
                    setDepositInfo({ percent: json.depositPercent, cop: json.depositCOP });
                    window.location.href = json.url;
                  } catch (e: any) { setFormError(e?.message ?? "Error generando el pago."); }
                }}
              >
                <FiCreditCard /> Pagar anticipo ahora
              </Button>

              <Button type="button" onClick={() => setCreated(null)} className="w-full mt-3 bg-surface-container hover:bg-surface-container-high text-on-surface font-bold py-3">
                Hacer otra reserva
              </Button>
            </div>
          </div>
        ) : (
          /* ─── BOOKING FORM ─── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-8 space-y-10">
              <section>
                <h1 className="text-3xl font-bold text-on-surface mb-1">Reserva tu Cancha</h1>
                <p className="text-on-surface-variant">Selecciona los detalles para tu próximo partido.</p>
              </section>

              <form onSubmit={handleSubmit(onSubmit)} id="booking-form" className="space-y-10">
                {/* Step 1: Field */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">sports_soccer</span>
                    <h2 className="font-semibold text-sm uppercase tracking-wider">1. Selecciona la Cancha</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      onClick={() => setValue("cancha", 1)}
                      className={`cursor-pointer relative overflow-hidden rounded-xl border-2 transition-all hover:shadow-lg active:scale-[0.98] ${cancha === 1 ? "border-primary bg-primary-container/10 shadow-md" : "border-outline-variant/30 bg-surface-container-lowest hover:border-primary/50"}`}
                    >
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-on-surface">Cancha 1 (Fútbol 5)</h3>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${cancha === 1 ? "border-primary bg-primary" : "border-outline-variant"}`}>
                            {cancha === 1 && <span className="material-symbols-outlined text-on-primary text-[16px]">check</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">groups</span> 10 Jugadores</span>
                          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">verified</span> Grama Pro</span>
                        </div>
                        {cancha === 1 && <div className="mt-3 text-xs font-bold text-primary">{formatCOP(price)} / hora</div>}
                      </div>
                    </div>
                    <div
                      onClick={() => setValue("cancha", 2)}
                      className={`cursor-pointer relative overflow-hidden rounded-xl border-2 transition-all hover:shadow-lg active:scale-[0.98] ${cancha === 2 ? "border-primary bg-primary-container/10 shadow-md" : "border-outline-variant/30 bg-surface-container-lowest hover:border-primary/50"}`}
                    >
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-on-surface">Cancha 2 (Fútbol 5)</h3>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${cancha === 2 ? "border-primary bg-primary" : "border-outline-variant"}`}>
                            {cancha === 2 && <span className="material-symbols-outlined text-on-primary text-[16px]">check</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">groups</span> 10 Jugadores</span>
                          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">verified</span> Grama Pro</span>
                        </div>
                        {cancha === 2 && <div className="mt-3 text-xs font-bold text-primary">{formatCOP(price)} / hora</div>}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Step 2 & 3: Date & Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">calendar_month</span>
                      <h2 className="font-semibold text-sm uppercase tracking-wider">2. Fecha</h2>
                    </div>
                    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4">
                      <input
                        {...register("date")}
                        type="date"
                        className="w-full rounded-lg border border-outline-variant bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                      {errors.date && <p className="mt-2 text-xs text-error font-semibold">{errors.date.message}</p>}
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">schedule</span>
                      <h2 className="font-semibold text-sm uppercase tracking-wider">3. Horario</h2>
                    </div>
                    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4">
                      <select
                        {...register("hour", { valueAsNumber: true })}
                        className="w-full rounded-lg border border-outline-variant bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        {hourOptions.map((h) => (
                          <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                        ))}
                      </select>
                      {errors.hour && <p className="mt-2 text-xs text-error font-semibold">{errors.hour.message}</p>}
                    </div>
                  </section>
                </div>

                {/* Phone required */}
                {userEmail && !profilePhone && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <div className="font-bold mb-1">Registra tu teléfono</div>
                    <p className="text-xs text-amber-800 mb-3">Necesitamos tu número (WhatsApp) para confirmar tu reserva.</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={phoneDraft}
                        onChange={(e) => setPhoneDraft(e.target.value)}
                        placeholder="Ej: 3001234567"
                        className="w-full rounded-lg border border-amber-200 bg-white px-4 py-2.5 text-sm outline-none"
                      />
                      <Button type="button" onClick={async () => {
                        setFormError(null);
                        const { data: authData } = await supabase.auth.getUser();
                        const u = authData.user;
                        if (!u) return;
                        const phone = phoneDraft.trim();
                        if (phone.length < 7) { setFormError("Ingresa un número válido."); return; }
                        const { error } = await supabase.from("profiles").update({ phone }).eq("id", u.id);
                        if (error) { setFormError(error.message); return; }
                        setProfilePhone(phone);
                      }} className="shrink-0">Guardar</Button>
                    </div>
                  </div>
                )}
              </form>
            </div>

            {/* Right Column: Summary Sidebar */}
            <aside className="lg:col-span-4">
              <div className="sticky top-28 space-y-5">
                {/* Summary Card */}
                <div className="bg-inverse-surface text-surface rounded-2xl p-6 shadow-xl">
                  <h3 className="font-bold text-lg mb-5 border-b border-surface-variant/20 pb-3">Resumen</h3>
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] text-surface-variant uppercase tracking-widest mb-0.5">Cancha</p>
                        <p className="font-semibold text-sm">Cancha {cancha}</p>
                      </div>
                      <span className="material-symbols-outlined text-primary-fixed">stadium</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] text-surface-variant uppercase tracking-widest mb-0.5">Horario</p>
                        <p className="font-semibold text-sm">{String(hour).padStart(2, "0")}:00 • {hour < 18 ? "Mañana" : "Noche"}</p>
                      </div>
                      <span className="material-symbols-outlined text-primary-fixed">schedule</span>
                    </div>
                    <div className="pt-4 border-t border-surface-variant/20 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Total Reserva</span>
                        <span className="font-bold">{formatCOP(price)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-primary-fixed">
                        <span>Anticipo ({depositInfo ? `${depositInfo.percent}%` : "30%"})</span>
                        <span className="font-bold">{formatCOP(price * 0.3)}</span>
                      </div>
                    </div>
                  </div>

                  {formError && (
                    <div className="mb-4 rounded-lg border border-error/30 bg-error-container/20 p-3 text-xs text-error font-semibold">{formError}</div>
                  )}

                  <button
                    type="submit"
                    form="booking-form"
                    disabled={isSubmitting || !userEmail || !profilePhone}
                    className="w-full bg-primary-fixed text-on-primary-fixed py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Procesando..." : !userEmail ? "Inicia sesión" : !profilePhone ? "Registra tu teléfono" : "Reservar y Pagar Anticipo"}
                    <span className="material-symbols-outlined text-lg">payments</span>
                  </button>
                  <p className="text-center text-[10px] text-surface-variant mt-3 opacity-70">
                    Transacción segura garantizada por Wompi.
                  </p>
                </div>

                {/* Info Card */}
                <div className="glass-card rounded-2xl p-5 border border-outline-variant/20">
                  <h4 className="font-bold text-sm mb-3">Información Importante</h4>
                  <ul className="text-xs space-y-2.5 text-on-surface-variant">
                    <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-[16px]">info</span> El saldo restante se paga en taquilla.</li>
                    <li className="flex gap-2"><span className="material-symbols-outlined text-primary text-[16px]">cancel</span> Cancelaciones con 24h de antelación.</li>
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
