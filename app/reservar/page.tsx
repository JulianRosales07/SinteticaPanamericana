"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState, useCallback } from "react";
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

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DAY_NAMES = ["D", "L", "M", "M", "J", "V", "S"];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
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
  const [depositPercent, setDepositPercent] = useState<number>(30);
  const [reservedSlots, setReservedSlots] = useState<string[]>([]);

  // Calendar state
  const today = useMemo(() => new Date(), []);
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());

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
    supabase
      .from("payment_settings")
      .select("deposit_percent")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.deposit_percent) setDepositPercent(data.deposit_percent);
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
      date: today.toISOString().slice(0, 10),
      hour: 18,
    },
  });

  const cancha = watch("cancha");
  const hour = watch("hour");
  const selectedDate = watch("date");

  const price = useMemo(() => {
    return pricingService.getPriceForHour(cancha, hour);
  }, [cancha, hour, dbRules, pricingService]);

  // Fetch reserved slots when cancha or date changes
  const fetchReservedSlots = useCallback(async () => {
    if (!selectedDate) return;
    const { data } = await supabase
      .from("reservations")
      .select("hour")
      .eq("court_id", cancha)
      .eq("date", selectedDate)
      .in("status", ["confirmed", "pending_payment"]);
    setReservedSlots((data ?? []).map((r: any) => String(r.hour)));
  }, [supabase, cancha, selectedDate]);

  useEffect(() => {
    fetchReservedSlots();
  }, [fetchReservedSlots]);

  // Calendar navigation
  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };

  const { firstDay, daysInMonth } = useMemo(() => getCalendarDays(calYear, calMonth), [calYear, calMonth]);

  const handleDateSelect = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setValue("date", dateStr);
  };

  const handleTimeSelect = (h: number) => {
    if (reservedSlots.includes(String(h))) return;
    setValue("hour", h);
  };

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

    try {
      const res = await fetch(`/api/wompi/checkout-url?reservationId=${encodeURIComponent(data.id)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json?.error ?? "No se pudo generar el enlace de pago.");
        setCreated(data);
        return;
      }
      setDepositInfo({ percent: json.depositPercent, cop: json.depositCOP });
      window.location.href = json.url;
    } catch (e: any) {
      setFormError(e?.message ?? "Error generando el pago. Puedes intentar pagar desde 'Mis Reservas'.");
      setCreated(data);
    }
  }

  return (
    <div className="min-h-screen bg-surface turf-accent pt-32 pb-24">
      <div className="max-w-[1280px] mx-auto px-4 md:px-12">
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-8 space-y-12">
              {/* Section Header */}
              <section>
                <h1 className="font-[family-name:var(--font-montserrat)] text-[32px] leading-[40px] font-bold text-on-surface mb-2">
                  Reserva tu Cancha
                </h1>
                <p className="text-secondary text-lg">Selecciona los detalles para tu próximo partido.</p>
              </section>

              <form onSubmit={handleSubmit(onSubmit)} id="booking-form" className="space-y-12">
                {/* Step 1: Field Selection */}
                <section className="space-y-6">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">sports_soccer</span>
                    <h2 className="font-[family-name:var(--font-montserrat)] text-xl font-semibold uppercase tracking-wider">
                      1. Selecciona la Cancha
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Cancha 1 */}
                    <div
                      onClick={() => setValue("cancha", 1)}
                      className={`group cursor-pointer relative overflow-hidden rounded-xl border-2 transition-all hover:shadow-lg active:scale-[0.98] bg-surface-container-lowest ${
                        cancha === 1
                          ? "border-primary shadow-md"
                          : "border-outline-variant/30 hover:border-primary"
                      }`}
                    >
                      <div className="aspect-video w-full overflow-hidden relative">
                        <img
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBb0vnFdc9gOliwS4TtDZZNmox2n7-iP7Ez4vCyTuvK2EAezFQst_gpZCu--2GcwXkJJVo8nW8CO9kq7GrEo-QC51fYb4DJt9cJyjAzy_9unzMHDOalLWJ5JirrO-l-ODMqVFIuC2W4TFkXZH-6vokn13JVg0483HFdwjNp8VepwqIFE77AXXsvAhuvQ0cocAeDvJQuZJNESQSsjxxvX-zozPPz1Kv3wf2C1Pq1N-g0yL1P7592aa1tE-RdgYyT5qCnMkrQTEdiUQ4"
                          alt="Cancha 1 - Sintética profesional al atardecer"
                        />
                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-primary shadow-sm">
                          {formatCOP(pricingService.getPriceForHour(1, hour))} / hr
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-[family-name:var(--font-montserrat)] text-xl font-semibold mb-1">
                          Cancha 1 (Fútbol 5)
                        </h3>
                        <div className="flex items-center gap-4 text-secondary text-xs font-semibold">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[18px]">groups</span> 10 Jugadores
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[18px]">verified</span> Grama Pro
                          </span>
                        </div>
                      </div>
                      {cancha === 1 && (
                        <div className="absolute inset-0 bg-primary/10 border-4 border-primary rounded-xl pointer-events-none" />
                      )}
                    </div>

                    {/* Cancha 2 */}
                    <div
                      onClick={() => setValue("cancha", 2)}
                      className={`group cursor-pointer relative overflow-hidden rounded-xl border-2 transition-all hover:shadow-lg active:scale-[0.98] bg-surface-container-lowest ${
                        cancha === 2
                          ? "border-primary shadow-md"
                          : "border-outline-variant/30 hover:border-primary"
                      }`}
                    >
                      <div className="aspect-video w-full overflow-hidden relative">
                        <img
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBZKrVEm1zoN1iNFWKPXf2MZz7djpYYwdVvF-5uGuKu_qpbqnkLYbg3lvU65GLtu9b3bQqHqdn8UscHSmeGz9qfB2amAVM7Rfz0kwWOW_tytpkujFc6UffBEMFvVshfHDFy4kPI_DiAY33BrQaP4Tt2N-PA0CpDxMqIEbAtQLbGgbq-8tvBcpu0I_ANFg7juROIwUUAyukXN5cLkeI4d98_9f6Deyy7pVjyKVV13cDB1k9Ln2WSusoSESDPrZGYfvotLVriy_z7Weo"
                          alt="Cancha 2 - Césped sintético premium"
                        />
                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-primary shadow-sm">
                          {formatCOP(pricingService.getPriceForHour(2, hour))} / hr
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-[family-name:var(--font-montserrat)] text-xl font-semibold mb-1">
                          Cancha 2 (Fútbol 5)
                        </h3>
                        <div className="flex items-center gap-4 text-secondary text-xs font-semibold">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[18px]">groups</span> 10 Jugadores
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[18px]">verified</span> Grama Pro
                          </span>
                        </div>
                      </div>
                      {cancha === 2 && (
                        <div className="absolute inset-0 bg-primary/10 border-4 border-primary rounded-xl pointer-events-none" />
                      )}
                    </div>
                  </div>
                </section>

                {/* Step 2 & 3: Date & Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Date Selection - Calendar */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">calendar_month</span>
                      <h2 className="font-[family-name:var(--font-montserrat)] text-xl font-semibold uppercase tracking-wider">
                        2. Selecciona la Fecha
                      </h2>
                    </div>
                    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-6 shadow-sm">
                      {/* Calendar Header */}
                      <div className="flex justify-between items-center mb-6">
                        <button
                          type="button"
                          onClick={prevMonth}
                          className="p-2 hover:bg-surface-container rounded-full transition-colors"
                        >
                          <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <span className="font-[family-name:var(--font-montserrat)] text-xl font-semibold">
                          {MONTH_NAMES[calMonth]} {calYear}
                        </span>
                        <button
                          type="button"
                          onClick={nextMonth}
                          className="p-2 hover:bg-surface-container rounded-full transition-colors"
                        >
                          <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                      </div>
                      {/* Day headers */}
                      <div className="grid grid-cols-7 gap-2 text-center mb-4">
                        {DAY_NAMES.map((d, i) => (
                          <span key={i} className="text-xs font-semibold text-secondary">{d}</span>
                        ))}
                      </div>
                      {/* Calendar Grid */}
                      <div className="grid grid-cols-7 gap-2">
                        {/* Empty slots */}
                        {Array.from({ length: firstDay }).map((_, i) => (
                          <div key={`empty-${i}`} className="h-10" />
                        ))}
                        {/* Days */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const day = i + 1;
                          const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                          const isSelected = selectedDate === dateStr;
                          const dateObj = new Date(calYear, calMonth, day);
                          const isPast = dateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate());

                          return (
                            <button
                              key={day}
                              type="button"
                              disabled={isPast}
                              onClick={() => !isPast && handleDateSelect(day)}
                              className={`h-10 w-full rounded-lg text-xs font-semibold transition-all ${
                                isPast
                                  ? "text-outline-variant cursor-not-allowed"
                                  : "hover:bg-primary-container/20"
                              } ${
                                isSelected
                                  ? "bg-primary text-on-primary shadow-md"
                                  : "text-on-surface"
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Hidden input for react-hook-form */}
                    <input type="hidden" {...register("date")} />
                    {errors.date && <p className="text-xs text-error font-semibold">{errors.date.message}</p>}
                  </section>

                  {/* Time Selection - Grid */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">schedule</span>
                      <h2 className="font-[family-name:var(--font-montserrat)] text-xl font-semibold uppercase tracking-wider">
                        3. Horario
                      </h2>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {hourOptions.map((h) => {
                        const isReserved = reservedSlots.includes(String(h));
                        const isSelected = hour === h;
                        const timeStr = `${String(h).padStart(2, "0")}:00`;

                        return (
                          <button
                            key={h}
                            type="button"
                            disabled={isReserved}
                            onClick={() => handleTimeSelect(h)}
                            className={`px-4 py-3 rounded-lg border-2 text-xs font-bold transition-all flex items-center justify-between ${
                              isReserved
                                ? "bg-surface-container-high border-outline-variant/30 text-outline cursor-not-allowed opacity-50"
                                : "bg-surface-container-lowest border-outline-variant/30 hover:border-primary"
                            } ${
                              isSelected && !isReserved
                                ? "border-primary bg-primary-container/10 text-primary"
                                : ""
                            }`}
                          >
                            {timeStr}
                            <span className="material-symbols-outlined text-[16px]">
                              {isReserved ? "block" : isSelected ? "check_circle" : "add_circle"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {/* Hidden input for react-hook-form */}
                    <input type="hidden" {...register("hour", { valueAsNumber: true })} />
                    {errors.hour && <p className="text-xs text-error font-semibold">{errors.hour.message}</p>}
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

            {/* Right Column: Sticky Sidebar */}
            <aside className="lg:col-span-4">
              <div className="sticky top-28 space-y-6">
                {/* Summary Card */}
                <div className="bg-inverse-surface text-surface rounded-2xl p-8 shadow-xl">
                  <h3 className="font-[family-name:var(--font-montserrat)] text-[32px] leading-[40px] font-bold mb-8 border-b border-surface-variant/20 pb-4">
                    Resumen
                  </h3>
                  <div className="space-y-6 mb-8">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-surface-variant uppercase tracking-widest mb-1">Cancha</p>
                        <p className="font-[family-name:var(--font-montserrat)] text-xl font-semibold">
                          Cancha {cancha}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-primary-fixed">stadium</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-surface-variant uppercase tracking-widest mb-1">Fecha y Hora</p>
                        <p className="font-[family-name:var(--font-montserrat)] text-xl font-semibold">
                          {selectedDate
                            ? `${MONTH_NAMES[parseInt(selectedDate.split("-")[1]) - 1]} ${parseInt(selectedDate.split("-")[2])}, ${String(hour).padStart(2, "0")}:00`
                            : "-- / --"}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-primary-fixed">calendar_today</span>
                    </div>
                    <div className="pt-6 border-t border-surface-variant/20 space-y-4">
                      <div className="flex justify-between text-lg">
                        <span>Total Reserva</span>
                        <span className="font-bold">{formatCOP(price)}</span>
                      </div>
                      <div className="flex justify-between text-base text-primary-fixed">
                        <span>Anticipo Requerido ({depositPercent}%)</span>
                        <span className="font-bold">{formatCOP(Math.round(price * depositPercent / 100))}</span>
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
                    className="w-full bg-primary-fixed text-on-primary-fixed py-4 rounded-xl font-bold text-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>
                      {isSubmitting
                        ? "Procesando..."
                        : !userEmail
                        ? "Inicia sesión"
                        : !profilePhone
                        ? "Registra tu teléfono"
                        : "Pagar con Wompi"}
                    </span>
                    <span className="material-symbols-outlined">payments</span>
                  </button>
                  <p className="text-center text-xs text-surface-variant mt-4 opacity-70">
                    Transacción segura garantizada por Wompi Bancolombia.
                  </p>
                </div>

                {/* Info Card */}
                <div className="glass-card rounded-2xl p-6 border border-outline-variant/20">
                  <h4 className="font-[family-name:var(--font-montserrat)] text-xl font-semibold mb-3">
                    Información Importante
                  </h4>
                  <ul className="text-base space-y-3 text-secondary">
                    <li className="flex gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">info</span>
                      El saldo restante se paga en taquilla.
                    </li>
                    <li className="flex gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">cancel</span>
                      Cancelaciones con 24h de antelación.
                    </li>
                    <li className="flex gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                      Incluye petos e hidratación básica.
                    </li>
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
