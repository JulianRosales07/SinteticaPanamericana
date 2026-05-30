"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiShield } from "react-icons/fi";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

export function Footer() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile?.role === "admin") setIsAdmin(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setIsAdmin(false);
        return;
      }
      supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          setIsAdmin(profile?.role === "admin");
        });
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <footer className="mt-auto bg-zinc-950 text-zinc-200">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-3">
        <div>
          <div className="text-lg font-semibold">Cancha Sintética</div>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            Sistema de reservas para Cancha 1 y Cancha 2, con precios por horario
            (mañana/noche).
          </p>
        </div>

        <div>
          <div className="text-sm font-semibold tracking-wide text-white">
            Navegación
          </div>
          {isAdmin ? (
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              <li>
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 hover:text-white"
                >
                  <FiShield /> Panel de administración
                </Link>
              </li>
            </ul>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              <li>
                <Link href="/" className="hover:text-white">
                  Inicio
                </Link>
              </li>
              <li>
                <Link href="/reservar" className="hover:text-white">
                  Reservar
                </Link>
              </li>
              <li>
                <Link href="/#precios" className="hover:text-white">
                  Precios
                </Link>
              </li>
              <li>
                <Link href="/#contacto" className="hover:text-white">
                  Contacto
                </Link>
              </li>
            </ul>
          )}
        </div>

        <div>
          <div className="text-sm font-semibold tracking-wide text-white">
            Contacto
          </div>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            <li>WhatsApp: +57 3223647348</li>
            <li>Dirección: (pendiente)</li>
            <li>Horario: 06:00–23:00</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-6 text-center text-xs text-zinc-400">
        © {new Date().getFullYear()} Cancha Sintética. Todos los derechos
        reservados.
      </div>
    </footer>
  );
}
