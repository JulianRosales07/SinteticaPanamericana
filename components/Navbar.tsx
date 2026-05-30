"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FiLogIn, FiLogOut, FiUser, FiMenu, FiX } from "react-icons/fi";
import type { AuthUser } from "../lib/types";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

export function Navbar({ hidden }: { hidden?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (!u) { setUser(null); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, username")
        .eq("id", u.id)
        .maybeSingle();
      const role = (profile?.role as AuthUser["role"] | undefined) ?? "user";
      const username = profile?.username ?? u.email ?? "usuario";
      const avatarUrl = u.user_metadata?.avatar_url ?? null;
      setUser({ username, role, avatarUrl });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      if (!u) { setUser(null); return; }
      supabase
        .from("profiles")
        .select("role, username")
        .eq("id", u.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          const role = (profile?.role as AuthUser["role"] | undefined) ?? "user";
          const username = profile?.username ?? u.email ?? "usuario";
          const avatarUrl = u.user_metadata?.avatar_url ?? null;
          setUser({ username, role, avatarUrl });
        });
    });

    return () => { sub.subscription.unsubscribe(); };
  }, [pathname]);

  const links = useMemo(() => {
    if (user?.role === "admin") return [];
    const base = [
      { href: "/", label: "Inicio" },
      { href: "/reservar", label: "Reservar" },
      { href: "/#precios", label: "Precios" },
      { href: "/#contacto", label: "Contacto" },
    ];
    if (user) {
      base.push({ href: "/perfil", label: "Mi Perfil" });
      base.push({ href: "/reservas", label: "Mis Reservas" });
    }
    return base;
  }, [user]);

  function onLogout() {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.signOut().finally(() => {
      setUser(null);
      router.push("/login");
    });
  }

  return (
    <header className={`w-full fixed inset-x-0 top-0 z-50 bg-inverse-surface/95 backdrop-blur-md border-b border-white/10${hidden ? " hidden" : ""}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href={user?.role === "admin" ? "/admin" : "/"} className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform bg-primary-container">
            <span className="material-symbols-outlined text-xl text-on-primary-container">sports_soccer</span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-black tracking-tight text-white">
              Sintéticas Panamericana
            </div>
            <div className="text-[10px] font-semibold text-white/60">
              Reservas Online
            </div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-6 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-bold transition-all ${
                pathname === l.href
                  ? "text-white border-b-2 border-primary-fixed pb-1"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <>
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <div className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden bg-primary-container">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    <FiUser className="text-on-primary-container text-xs" />
                  )}
                </div>
                <span className="text-white/90">{user.username}</span>
              </div>
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all"
              >
                <FiLogOut /> Cerrar sesión
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold bg-primary-fixed text-on-primary-fixed hover:scale-105 transition-all shadow-lg"
            >
              <FiLogIn /> Iniciar sesión
            </Link>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-all lg:hidden outline-none border border-white/20 text-white hover:bg-white/10"
        >
          {menuOpen ? <FiX size={18} /> : <FiMenu size={18} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="absolute inset-x-0 top-full py-5 px-6 lg:hidden flex flex-col gap-4 shadow-2xl z-50 bg-inverse-surface/95 backdrop-blur-md border-t border-white/10">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm font-bold py-3 px-4 rounded-xl transition-all ${
                  pathname === l.href
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-3 pt-2 border-t border-white/10">
            {user ? (
              <>
                <div className="flex items-center justify-center gap-2 text-sm font-bold py-2 text-white">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden bg-primary-container">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                    ) : (
                      <FiUser className="text-on-primary-container text-xs" />
                    )}
                  </div>
                  <span>{user.username}</span>
                </div>
                <button onClick={onLogout} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold w-full bg-white/10 text-white border border-white/20">
                  <FiLogOut /> Cerrar sesión
                </button>
              </>
            ) : (
              <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold w-full bg-primary-fixed text-on-primary-fixed shadow-lg">
                <FiLogIn /> Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
