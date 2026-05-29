"use client";

import { useEffect, useState, useMemo } from "react";
import { FiCalendar, FiClock, FiMapPin } from "react-icons/fi";
import { LinkButton } from "../components/Button";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Home() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [prices, setPrices] = useState({
    c1Morning: 80000,
    c1Evening: 100000,
    c2Morning: 80000,
    c2Evening: 100000,
  });

  useEffect(() => {
    async function loadPrices() {
      try {
        const { data, error } = await supabase
          .from("pricing_rules")
          .select("court_id, start_hour, price_cop")
          .eq("active", true);

        if (!error && data) {
          const newPrices = { ...prices };
          data.forEach((r: any) => {
            if (r.court_id === 1) {
              if (r.start_hour === 6) newPrices.c1Morning = r.price_cop;
              else if (r.start_hour === 18) newPrices.c1Evening = r.price_cop;
            } else if (r.court_id === 2) {
              if (r.start_hour === 6) newPrices.c2Morning = r.price_cop;
              else if (r.start_hour === 18) newPrices.c2Evening = r.price_cop;
            }
          });
          setPrices(newPrices);
        }
      } catch (e) {
        console.error("Error cargando tarifas dinámicas", e);
      }
    }
    loadPrices();
  }, [supabase]);

  return (
    <div className="bg-surface">
      {/* ─── HERO ─── */}
      <section
        className="relative h-screen w-full flex items-center justify-center overflow-hidden"
        style={{ backgroundImage: "url('/hero-stadium.jpg')", backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="absolute inset-0 bg-linear-to-t from-on-background/80 via-on-background/40 to-transparent" />

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-black text-white mb-6 leading-tight tracking-tight">
            El partido de tu vida empieza aquí
          </h1>
          <p className="text-lg text-white/90 mb-10 max-w-2xl mx-auto leading-relaxed">
            Reserva las mejores canchas sintéticas de la ciudad con tecnología de punta y la mejor iluminación para tus encuentros nocturnos.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <LinkButton
              href="/reservar"
              variant="primary"
              className="px-8 py-4 bg-primary-container text-on-primary-container font-bold rounded-lg shadow-xl hover:bg-primary-fixed transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">calendar_month</span>
              Reservar ahora
            </LinkButton>
            <LinkButton
              href="/#precios"
              variant="secondary"
              className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/30 text-white font-bold rounded-lg hover:bg-white/20 transition-all"
            >
              Ver precios
            </LinkButton>
          </div>
        </div>
      </section>

      {/* ─── PRECIOS / CANCHAS ─── */}
      <section id="precios" className="py-24 px-4 md:px-12 max-w-6xl mx-auto turf-pattern">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-on-surface mb-4">Nuestras Canchas</h2>
          <p className="text-on-surface-variant max-w-xl mx-auto">
            Precios competitivos para que no dejes de jugar. Elige la que mejor se adapte a tu equipo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Cancha 1 */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/30 shadow-sm group">
            <div className="h-48 relative overflow-hidden bg-inverse-surface">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-6xl text-primary-fixed/30">sports_soccer</span>
              </div>
              <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-md px-4 py-1 rounded-full text-primary font-bold shadow-sm text-sm">
                Fútbol 5
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold text-on-surface mb-5">Cancha 1</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-4 bg-surface-container rounded-lg border border-outline-variant/20">
                  <div>
                    <span className="block text-xs font-semibold text-on-surface-variant">Día (06:00 - 17:59)</span>
                    <span className="text-primary font-bold text-lg">{formatCOP(prices.c1Morning)} / hr</span>
                  </div>
                  <span className="material-symbols-outlined text-primary-fixed-dim">wb_sunny</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-inverse-surface rounded-lg">
                  <div>
                    <span className="block text-xs font-semibold text-surface-variant">Noche (18:00 - 23:59)</span>
                    <span className="text-primary-fixed font-bold text-lg">{formatCOP(prices.c1Evening)} / hr</span>
                  </div>
                  <span className="material-symbols-outlined text-primary-fixed">dark_mode</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cancha 2 */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/30 shadow-sm group">
            <div className="h-48 relative overflow-hidden bg-inverse-surface">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-6xl text-primary-fixed/30">stadium</span>
              </div>
              <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-md px-4 py-1 rounded-full text-primary font-bold shadow-sm text-sm">
                Fútbol 5
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold text-on-surface mb-5">Cancha 2</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-4 bg-surface-container rounded-lg border border-outline-variant/20">
                  <div>
                    <span className="block text-xs font-semibold text-on-surface-variant">Día (06:00 - 17:59)</span>
                    <span className="text-primary font-bold text-lg">{formatCOP(prices.c2Morning)} / hr</span>
                  </div>
                  <span className="material-symbols-outlined text-primary-fixed-dim">wb_sunny</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-inverse-surface rounded-lg">
                  <div>
                    <span className="block text-xs font-semibold text-surface-variant">Noche (18:00 - 23:59)</span>
                    <span className="text-primary-fixed font-bold text-lg">{formatCOP(prices.c2Evening)} / hr</span>
                  </div>
                  <span className="material-symbols-outlined text-primary-fixed">dark_mode</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CÓMO FUNCIONA ─── */}
      <section className="py-24 bg-inverse-surface text-white">
        <div className="max-w-6xl mx-auto px-4 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <h2 className="text-3xl font-bold mb-4">¿Cómo Funciona?</h2>
              <p className="text-white/70 leading-relaxed">
                Reserva tu cancha en 3 simples pasos. Sin complicaciones, sin esperas.
              </p>
            </div>
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
                <div className="w-10 h-10 rounded-lg bg-primary-fixed/20 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-primary-fixed">sports_soccer</span>
                </div>
                <h3 className="font-bold mb-2">1. Elige tu cancha</h3>
                <p className="text-sm text-white/70">Selecciona entre nuestras canchas disponibles.</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
                <div className="w-10 h-10 rounded-lg bg-primary-fixed/20 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-primary-fixed">calendar_month</span>
                </div>
                <h3 className="font-bold mb-2">2. Fecha y hora</h3>
                <p className="text-sm text-white/70">Escoge el horario que mejor te convenga.</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all sm:col-span-2">
                <div className="w-10 h-10 rounded-lg bg-primary-fixed/20 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-primary-fixed">payments</span>
                </div>
                <h3 className="font-bold mb-2">3. Paga y juega</h3>
                <p className="text-sm text-white/70">Confirma con un anticipo vía Wompi y listo. El saldo se paga en taquilla.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CONTACTO ─── */}
      <section id="contacto" className="py-24 px-4 md:px-12 max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-12 bg-surface-container-low rounded-3xl overflow-hidden border border-outline-variant/30">
          {/* Map */}
          <div className="lg:w-1/2 min-h-[300px]">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d498.4111306352932!2d-77.2849349!3d1.2053635!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e2ed49e73c41397%3A0x1f6346a3957a3b84!2zU2ludMOpdGljYXMgcGFuYW1lcmljYW5h!5e0!3m2!1ses!2sco!4v1716912000000!5m2!1ses!2sco"
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: "300px" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          {/* Info */}
          <div className="lg:w-1/2 p-8 flex flex-col justify-center">
            <h2 className="text-2xl font-bold text-on-surface mb-2">Encuéntranos</h2>
            <p className="text-on-surface-variant mb-8">Visítanos y vive la mejor experiencia deportiva.</p>

            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
                  <FiMapPin className="text-on-primary-container" />
                </div>
                <div>
                  <div className="font-bold text-on-surface text-sm">Dirección</div>
                  <p className="text-sm text-on-surface-variant">Panamericana, Pasto, Nariño</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
                  <FiClock className="text-on-primary-container" />
                </div>
                <div>
                  <div className="font-bold text-on-surface text-sm">Horario</div>
                  <p className="text-sm text-on-surface-variant">Lunes a Domingo: 06:00 – 23:00</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
                  <FiCalendar className="text-on-primary-container" />
                </div>
                <div>
                  <div className="font-bold text-on-surface text-sm">Reservas</div>
                  <p className="text-sm text-on-surface-variant">Online 24/7 o por WhatsApp</p>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <LinkButton href="/reservar" variant="primary" className="bg-primary text-on-primary font-bold px-6 py-3 rounded-lg shadow-lg hover:scale-105 transition-transform">
                <FiCalendar /> Reservar ahora
              </LinkButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
