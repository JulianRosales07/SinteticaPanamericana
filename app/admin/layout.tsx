"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PropsWithChildren } from "react";
import { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiLoader } from "react-icons/fi";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const adminLinks = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/reservas", label: "Reservas" },
  { href: "/admin/facturas", label: "Facturas" },
  { href: "/admin/precios", label: "Precios/Canchas" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/pagos", label: "Abonos" },
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/ventas", label: "Ventas" },
  { href: "/admin/reportes", label: "Reportes" },
];

export default function AdminLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    email: string;
    role: string;
    errorName?: string;
    errorMessage?: string;
    errorCode?: string;
    rawProfile?: any;
  } | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }
      setEmail(user.email ?? "");

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      setDebugInfo({
        email: user.email ?? "(sin email)",
        role: profile?.role ?? "(sin rol)",
        errorName: error?.message,
        errorMessage: error?.details || error?.hint,
        errorCode: error?.code,
        rawProfile: profile,
      });

      setIsAdmin(profile?.role === "admin");
      setIsLoading(false);
    }

    load();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background">
        <FiLoader className="animate-spin text-3xl text-secondary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-background px-6 py-16 flex-grow flex items-center justify-center">
        <div className="mx-auto max-w-3xl rounded-3xl border border-outline-variant/30 bg-surface-container-low p-8 shadow-soft">
          <div className="flex items-start gap-3">
            <FiAlertTriangle className="mt-1 text-error" />
            <div className="w-full">
              <h1 className="text-2xl font-black tracking-tight text-on-surface">
                Acceso restringido
              </h1>
              <p className="mt-2 text-on-surface-variant">
                Este panel es solo para administradores. Inicia sesión con una
                cuenta de administrador.
              </p>

              {debugInfo && (
                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
                  <div className="font-semibold text-amber-800 mb-2">🔍 Diagnóstico de Autenticación</div>
                  <div className="space-y-1.5 text-amber-900 font-mono text-xs">
                    <div><strong>Email:</strong> {debugInfo.email}</div>
                    <div><strong>Rol detectado:</strong> {debugInfo.role}</div>
                    <div><strong>Perfil crudo:</strong> {JSON.stringify(debugInfo.rawProfile)}</div>
                    {debugInfo.errorName && (
                      <div className="mt-2 border-t border-amber-200 pt-2 text-red-700">
                        <div><strong>Error en Query:</strong> {debugInfo.errorName}</div>
                        <div><strong>Detalles:</strong> {debugInfo.errorMessage || "Ninguno"}</div>
                        <div><strong>Código:</strong> {debugInfo.errorCode || "Ninguno"}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="rounded-full bg-secondary px-5 py-3 text-sm font-semibold text-white hover:brightness-110 flex items-center justify-center transition-all"
                >
                  Ir a login
                </Link>
                <Link
                  href="/"
                  className="rounded-full border border-outline-variant/40 px-5 py-3 text-sm font-semibold text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center"
                >
                  Volver al inicio
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface turf-accent">
      {/* TopNavBar con glassmorphism */}
      <header className="glass-card sticky top-0 z-50 border-b border-outline-variant/30 shadow-lg">
        <div className="flex justify-between items-center w-full px-4 lg:px-10 py-4 lg:py-5 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-xl lg:text-2xl text-on-primary-container">sports_soccer</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm lg:text-lg font-black text-on-surface leading-none">Sintéticas Panamericana</h1>
              <p className="text-[10px] lg:text-xs font-semibold text-on-surface-variant">Panel de Administración</p>
            </div>
          </div>

          {/* Desktop: user info */}
          <div className="hidden lg:flex items-center gap-4">
            <div className="flex items-center gap-3 glass-effect px-5 py-2.5 rounded-xl border border-outline-variant/20">
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-lg text-on-primary-container">account_circle</span>
              </div>
              <span className="text-sm font-bold text-on-surface">{email}</span>
              <div className="h-4 w-[1px] bg-outline-variant/30"></div>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors group"
              >
                <span className="material-symbols-outlined text-lg group-hover:scale-110 transition-transform">logout</span>
                <span className="text-sm font-bold">Salir</span>
              </button>
            </div>
          </div>

          {/* Mobile/Tablet: hamburger button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-2xl text-on-surface">
              {mobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>

        {/* Desktop Navigation Bar */}
        <div className="hidden lg:block bg-surface-container-low border-t border-outline-variant/20">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between">
            <nav className="flex items-center gap-4 xl:gap-6 py-3 overflow-x-auto hide-scrollbar">
              {adminLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "text-sm font-bold transition-all whitespace-nowrap px-3 py-2 rounded-lg",
                    pathname === l.href
                      ? "text-primary bg-primary-container/20 border-b-2 border-primary"
                      : "text-on-surface-variant hover:text-primary hover:bg-surface-container"
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <Link 
              href="/admin/cuadre"
              className="ml-4 bg-secondary-container text-on-secondary-container px-6 py-2.5 rounded-xl text-sm font-bold hover:scale-105 transition-all shadow-lg whitespace-nowrap"
            >
              💰 Cuadre de caja
            </Link>
          </div>
        </div>

        {/* Mobile/Tablet Menu Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-outline-variant/20 bg-white">
            <nav className="flex flex-col px-4 py-3 gap-1">
              {adminLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "text-sm font-bold px-4 py-3 rounded-xl transition-all",
                    pathname === l.href
                      ? "text-primary bg-primary-container/20"
                      : "text-on-surface-variant hover:text-primary hover:bg-surface-container"
                  )}
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href="/admin/cuadre"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 bg-secondary-container text-on-secondary-container px-4 py-3 rounded-xl text-sm font-bold text-center"
              >
                💰 Cuadre de caja
              </Link>
            </nav>
            {/* User info en mobile */}
            <div className="border-t border-outline-variant/20 px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg text-on-primary-container">account_circle</span>
                </div>
                <span className="text-xs font-bold text-on-surface truncate max-w-[180px]">{email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-sm font-bold text-error hover:underline"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
                Salir
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 lg:px-10 py-8 lg:py-12">
        {children}
      </main>

      {/* Footer simplificado */}
      <footer className="bg-inverse-surface mt-auto border-t border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-xl text-on-primary-container">sports_soccer</span>
              </div>
              <div>
                <p className="text-sm font-black text-inverse-on-surface">Sintéticas Panamericana</p>
                <p className="text-xs text-inverse-on-surface/70">© {new Date().getFullYear()} Todos los derechos reservados</p>
              </div>
            </div>
            <div className="flex gap-6">
              <a className="text-xs text-inverse-on-surface/70 hover:text-inverse-on-surface transition-colors font-semibold" href="#">Soporte</a>
              <a className="text-xs text-inverse-on-surface/70 hover:text-inverse-on-surface transition-colors font-semibold" href="#">Manual</a>
              <a className="text-xs text-inverse-on-surface/70 hover:text-inverse-on-surface transition-colors font-semibold" href="#">Privacidad</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
