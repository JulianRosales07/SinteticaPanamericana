"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function CalendarSyncPage() {
  const [feedUrl, setFeedUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"google" | "apple" | "outlook">("google");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      setFeedUrl(`${origin}/api/admin/calendar/feed?token=panamericana_calendar_secret`);
    }
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("Error al copiar al portapapeles:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs font-bold text-on-surface-variant hover:text-primary transition-all"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Volver al Inicio
        </Link>
      </div>

      {/* Header */}
      <div>
        <h2 className="text-xl lg:text-2xl font-black tracking-tight text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-2xl lg:text-3xl text-primary">sync</span>
          Sincronizar Calendario
        </h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Vincula las reservas de la plataforma con la aplicación de calendario de tu celular (Google Calendar, Apple Calendar, Outlook, etc.) para verlas en tiempo real.
        </p>
      </div>

      {/* Feed URL Card */}
      <div className="bg-white rounded-2xl border border-outline-variant/30 p-5 lg:p-6 shadow-sm">
        <h3 className="text-sm font-bold text-on-surface mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-lg text-emerald-600">link</span>
          Tu Enlace de Calendario Personalizado
        </h3>
        <p className="text-xs text-on-surface-variant mb-4">
          Este enlace genera un flujo de datos en tiempo real (formato <code>iCalendar</code>). Importa este enlace en tu aplicación de calendario para iniciar la sincronización.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 items-stretch">
          <div className="flex-1 min-w-0 bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 flex items-center">
            <span className="text-xs font-mono text-on-surface truncate select-all w-full">
              {feedUrl || "Cargando enlace..."}
            </span>
          </div>
          <button
            onClick={handleCopy}
            disabled={!feedUrl}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 whitespace-nowrap cursor-pointer ${
              copied
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                : "bg-primary text-white hover:brightness-115 shadow-md shadow-primary/20"
            }`}
          >
            <span className="material-symbols-outlined text-lg">
              {copied ? "check_circle" : "content_copy"}
            </span>
            {copied ? "¡Enlace Copiado!" : "Copiar Enlace"}
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-3 flex items-start gap-2.5">
          <span className="material-symbols-outlined text-amber-800 text-lg mt-0.5">warning</span>
          <p className="text-[11px] leading-normal text-amber-900 font-medium">
            <strong>Nota de seguridad:</strong> Este enlace contiene un token de acceso exclusivo para tu negocio. No compartas este enlace públicamente para proteger la información de tus clientes.
          </p>
        </div>
      </div>

      {/* Tabs & Steps */}
      <div className="bg-white rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm">
        {/* Tabs Headers */}
        <div className="flex border-b border-outline-variant/20 bg-surface-container-lowest">
          <button
            onClick={() => setActiveTab("google")}
            className={`flex-1 py-4 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
              activeTab === "google"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
            }`}
          >
            <span className="material-symbols-outlined text-base">android</span>
            Google Calendar / Android / PC
          </button>
          <button
            onClick={() => setActiveTab("apple")}
            className={`flex-1 py-4 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
              activeTab === "apple"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
            }`}
          >
            <span className="material-symbols-outlined text-base">phone_iphone</span>
            Apple Calendar (iPhone)
          </button>
          <button
            onClick={() => setActiveTab("outlook")}
            className={`flex-1 py-4 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
              activeTab === "outlook"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
            }`}
          >
            <span className="material-symbols-outlined text-base">mail</span>
            Outlook / PC
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "google" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-blue-600 text-sm">info</span>
                </div>
                <h4 className="text-sm font-bold text-on-surface">Instrucciones para Google Calendar</h4>
              </div>

              <p className="text-xs text-on-surface-variant leading-relaxed">
                Dado que Google Calendar no permite añadir calendarios externos por enlace directamente desde la aplicación de celular, debemos hacer una configuración inicial muy sencilla desde tu computadora:
              </p>

              <ol className="relative border-l border-outline-variant/30 ml-3 space-y-5 mt-4">
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-primary-container text-on-primary-container rounded-full -left-3 ring-4 ring-white text-[11px] font-bold">
                    1
                  </span>
                  <h5 className="text-xs font-bold text-on-surface">Copia el enlace de arriba</h5>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Haz clic en el botón verde <strong>"Copiar Enlace"</strong> de la tarjeta anterior.
                  </p>
                </li>
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-primary-container text-on-primary-container rounded-full -left-3 ring-4 ring-white text-[11px] font-bold">
                    2
                  </span>
                  <h5 className="text-xs font-bold text-on-surface">Abre Google Calendar en tu computadora</h5>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Ingresa a su página web en <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">calendar.google.com</a> e inicia sesión con la misma cuenta de Google que usas en tu celular.
                  </p>
                </li>
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-primary-container text-on-primary-container rounded-full -left-3 ring-4 ring-white text-[11px] font-bold">
                    3
                  </span>
                  <h5 className="text-xs font-bold text-on-surface">Añadir calendario mediante enlace</h5>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    En la barra lateral izquierda, busca la sección **"Otros calendarios"**, haz clic en el botón **"+"** (Añadir otros calendarios) y selecciona la opción **"Desde URL"**.
                  </p>
                </li>
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-primary-container text-on-primary-container rounded-full -left-3 ring-4 ring-white text-[11px] font-bold">
                    4
                  </span>
                  <h5 className="text-xs font-bold text-on-surface">Pegar enlace y agregar</h5>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Pega el enlace copiado en el campo **"URL del calendario"** y haz clic en **"Añadir calendario"**. El calendario se creará y se cargará la lista de reservas.
                  </p>
                </li>
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-primary-container text-on-primary-container rounded-full -left-3 ring-4 ring-white text-[11px] font-bold">
                    5
                  </span>
                  <h5 className="text-xs font-bold text-on-surface">Activar la sincronización en tu celular 📱</h5>
                  <div className="text-[11px] text-on-surface-variant mt-1 space-y-1 bg-surface-container-low rounded-xl p-3 border border-outline-variant/10">
                    <p className="font-semibold text-on-surface">Sigue estos pasos en tu celular:</p>
                    <ol className="list-decimal list-inside space-y-1 pl-1">
                      <li>Abre la aplicación de **Google Calendar** en tu celular.</li>
                      <li>Toca el botón de menú lateral (las tres líneas horizontales arriba a la izquierda).</li>
                      <li>Desplázate hacia abajo y entra a **Ajustes** (Configuración).</li>
                      <li>Toca el nuevo calendario que aparecerá en tu lista (generalmente se llama *Reservas Panamericana*).</li>
                      <li>Activa el interruptor que dice **"Sincronizar"** (o **"Sync"**).</li>
                    </ol>
                  </div>
                </li>
              </ol>
            </div>
          )}

          {activeTab === "apple" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-slate-800 text-sm">info</span>
                </div>
                <h4 className="text-sm font-bold text-on-surface">Instrucciones para Apple Calendar (iOS)</h4>
              </div>

              <p className="text-xs text-on-surface-variant leading-relaxed">
                En tu iPhone o iPad, puedes añadir la sincronización de reservas directamente desde la configuración de tu celular para que aparezca en la app nativa de Calendario:
              </p>

              <ol className="relative border-l border-outline-variant/30 ml-3 space-y-5 mt-4">
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-primary-container text-on-primary-container rounded-full -left-3 ring-4 ring-white text-[11px] font-bold">
                    1
                  </span>
                  <h5 className="text-xs font-bold text-on-surface">Copia el enlace</h5>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Copia el enlace del calendario de arriba haciendo clic en **"Copiar Enlace"** (puedes hacerlo desde el navegador de tu celular).
                  </p>
                </li>
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-primary-container text-on-primary-container rounded-full -left-3 ring-4 ring-white text-[11px] font-bold">
                    2
                  </span>
                  <h5 className="text-xs font-bold text-on-surface">Abre Ajustes de tu iPhone</h5>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Ve a la aplicación de **Ajustes** de tu iPhone, desplázate hacia abajo y selecciona **Calendario**.
                  </p>
                </li>
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-primary-container text-on-primary-container rounded-full -left-3 ring-4 ring-white text-[11px] font-bold">
                    3
                  </span>
                  <h5 className="text-xs font-bold text-on-surface">Agregar Cuenta Calendario</h5>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Toca en **Cuentas**, luego selecciona **Añadir cuenta** y elige la opción **Otro** (al final de la lista).
                  </p>
                </li>
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-primary-container text-on-primary-container rounded-full -left-3 ring-4 ring-white text-[11px] font-bold">
                    4
                  </span>
                  <h5 className="text-xs font-bold text-on-surface">Suscribirse al Calendario</h5>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Toca en **Añadir calendario suscrito**. Pega el enlace que copiaste en el campo **Servidor** y toca en **Siguiente**.
                  </p>
                </li>
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-primary-container text-on-primary-container rounded-full -left-3 ring-4 ring-white text-[11px] font-bold">
                    5
                  </span>
                  <h5 className="text-xs font-bold text-on-surface">Guardar la Configuración</h5>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Verás los detalles de la suscripción. Puedes cambiar la descripción a *"Reservas Panamericana"* para identificarlo fácilmente. No requiere nombre de usuario ni contraseña. Toca en **Guardar**.
                  </p>
                </li>
              </ol>
            </div>
          )}

          {activeTab === "outlook" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-blue-800 text-sm">info</span>
                </div>
                <h4 className="text-sm font-bold text-on-surface">Instrucciones para Microsoft Outlook</h4>
              </div>

              <p className="text-xs text-on-surface-variant leading-relaxed">
                Si prefieres usar la aplicación o el sitio web de Outlook para gestionar tus horarios:
              </p>

              <ol className="relative border-l border-outline-variant/30 ml-3 space-y-5 mt-4">
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-primary-container text-on-primary-container rounded-full -left-3 ring-4 ring-white text-[11px] font-bold">
                    1
                  </span>
                  <h5 className="text-xs font-bold text-on-surface">Copia el enlace</h5>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Copia el enlace de arriba con el botón **"Copiar Enlace"**.
                  </p>
                </li>
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-primary-container text-on-primary-container rounded-full -left-3 ring-4 ring-white text-[11px] font-bold">
                    2
                  </span>
                  <h5 className="text-xs font-bold text-on-surface">Ingresa a Outlook Web o Aplicación</h5>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Entra a <a href="https://outlook.live.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">outlook.live.com</a> o abre tu programa Outlook en PC. Ve a la sección de **Calendario**.
                  </p>
                </li>
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-primary-container text-on-primary-container rounded-full -left-3 ring-4 ring-white text-[11px] font-bold">
                    3
                  </span>
                  <h5 className="text-xs font-bold text-on-surface">Agregar Calendario desde la Web</h5>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Toca en **Agregar calendario** (menú izquierdo) y selecciona la opción **Suscribirse desde la web** (o *Subscribe from web*).
                  </p>
                </li>
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-primary-container text-on-primary-container rounded-full -left-3 ring-4 ring-white text-[11px] font-bold">
                    4
                  </span>
                  <h5 className="text-xs font-bold text-on-surface">Pegar enlace e importar</h5>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Pega el enlace copiado, asígnale un nombre descriptivo como *"Reservas Sintética"* y haz clic en **Importar** o **Guardar**.
                  </p>
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* FAQ / Troubleshooting */}
      <div className="bg-surface-container-low rounded-2xl border border-outline-variant/20 p-5 lg:p-6 space-y-4">
        <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-lg text-primary">help</span>
          Preguntas Frecuentes y Diagnóstico
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-on-surface">¿Cuánto tarda en sincronizarse?</h4>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Google Calendar actualiza los calendarios suscritos por URL cada cierto tiempo (generalmente entre 8 y 24 horas). En Apple Calendar, la actualización suele ser más frecuente (dependiendo de la configuración de red).
            </p>
          </div>
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-on-surface">¿Qué datos se muestran en mi calendario?</h4>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Cada reserva creará un evento que indica: nombre del cliente, teléfono, número de cancha, precio total, abono recibido, saldo faltante, estado de pago e ID de la reserva.
            </p>
          </div>
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-on-surface">¿Qué pasa si se cancela una reserva?</h4>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Solo las reservas activas (no canceladas) se incluyen en este feed. Si cancelas una reserva desde el panel, desaparecerá automáticamente de tu calendario en la siguiente actualización.
            </p>
          </div>
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-on-surface">No me aparece en el celular (Google Calendar)</h4>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Recuerda activar el calendario en tu teléfono: abre la app de Google Calendar en el celular, ve a *Ajustes*, selecciona el calendario *"Reservas Panamericana"* y activa la casilla **"Sincronizar"**.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
