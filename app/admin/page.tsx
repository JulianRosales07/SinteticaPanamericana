"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

const modules = [
  {
    title: "Reservas",
    desc: "Gestionar reservas del día",
    href: "/admin/reservas",
    icon: "calendar_month",
    color: "bg-blue-500",
  },
  {
    title: "Ventas POS",
    desc: "Punto de venta snack bar",
    href: "/admin/ventas",
    icon: "point_of_sale",
    color: "bg-primary",
  },
  {
    title: "Productos",
    desc: "Inventario y stock",
    href: "/admin/productos",
    icon: "inventory_2",
    color: "bg-amber-500",
  },
  {
    title: "Facturas",
    desc: "Estados de pago",
    href: "/admin/facturas",
    icon: "receipt_long",
    color: "bg-purple-500",
  },
  {
    title: "Precios",
    desc: "Tarifas por cancha",
    href: "/admin/precios",
    icon: "attach_money",
    color: "bg-emerald-500",
  },
  {
    title: "Usuarios",
    desc: "Perfiles y roles",
    href: "/admin/usuarios",
    icon: "group",
    color: "bg-indigo-500",
  },
  {
    title: "Abonos",
    desc: "Configuración de anticipos",
    href: "/admin/pagos",
    icon: "payments",
    color: "bg-rose-500",
  },
  {
    title: "Cuadre de caja",
    desc: "Cierre diario",
    href: "/admin/cuadre",
    icon: "account_balance_wallet",
    color: "bg-teal-500",
  },
  {
    title: "Reportes",
    desc: "Ingresos diarios, semanales y mensuales",
    href: "/admin/reportes",
    icon: "analytics",
    color: "bg-violet-600",
  },
];

export default function AdminHomePage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [stats, setStats] = useState({
    reservasHoy: 0,
    reservasActivas: 0,
    ventasHoy: 0,
    ingresoHoy: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const today = new Date().toISOString().split("T")[0];

      const [resHoy, resActivas, ventasHoy] = await Promise.all([
        supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("date", today)
          .eq("status", "active"),
        supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("sales")
          .select("total_cop")
          .gte("sold_at", `${today}T00:00:00`)
          .lte("sold_at", `${today}T23:59:59`),
      ]);

      const ventasTotales = (ventasHoy.data ?? []).reduce(
        (acc: number, s: { total_cop: number }) => acc + s.total_cop,
        0
      );

      setStats({
        reservasHoy: resHoy.count ?? 0,
        reservasActivas: resActivas.count ?? 0,
        ventasHoy: (ventasHoy.data ?? []).length,
        ingresoHoy: ventasTotales,
      });
      setLoading(false);
    }

    loadStats();
  }, [supabase]);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-xl lg:text-2xl font-black tracking-tight text-on-surface">
          ¡Bienvenido al panel! 👋
        </h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Resumen del día y accesos rápidos.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon="calendar_today"
          label="Reservas hoy"
          value={loading ? "..." : String(stats.reservasHoy)}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          icon="event_available"
          label="Total activas"
          value={loading ? "..." : String(stats.reservasActivas)}
          color="text-primary"
          bg="bg-green-50"
        />
        <StatCard
          icon="shopping_cart"
          label="Ventas hoy"
          value={loading ? "..." : String(stats.ventasHoy)}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <StatCard
          icon="payments"
          label="Ingreso hoy"
          value={loading ? "..." : formatCOP(stats.ingresoHoy)}
          color="text-emerald-600"
          bg="bg-emerald-50"
          small
        />
      </div>

      {/* Quick Access Grid */}
      <div>
        <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-3">
          Módulos
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {modules.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group bg-white rounded-xl border border-outline-variant/30 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95"
            >
              <div className={`w-10 h-10 rounded-xl ${m.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <span className="material-symbols-outlined text-xl text-white">{m.icon}</span>
              </div>
              <p className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">{m.title}</p>
              <p className="text-[11px] text-on-surface-variant mt-0.5 leading-tight">{m.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-outline-variant/30 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-3">
          Acciones rápidas
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href="/admin/ventas"
            className="flex-1 flex items-center gap-3 px-4 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:brightness-110 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">point_of_sale</span>
            Abrir POS
          </Link>
          <Link
            href="/admin/reservas"
            className="flex-1 flex items-center gap-3 px-4 py-3 bg-blue-500 text-white rounded-xl font-bold text-sm hover:brightness-110 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">calendar_month</span>
            Ver reservas de hoy
          </Link>
          <Link
            href="/admin/cuadre"
            className="flex-1 flex items-center gap-3 px-4 py-3 bg-secondary text-white rounded-xl font-bold text-sm hover:brightness-110 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">account_balance_wallet</span>
            Cuadre de caja
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  bg,
  small,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  bg: string;
  small?: boolean;
}) {
  return (
    <div className={`${bg} rounded-xl p-3 lg:p-4 border border-outline-variant/20`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`material-symbols-outlined text-lg ${color}`}>{icon}</span>
        <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">{label}</span>
      </div>
      <p className={`${small ? "text-base" : "text-xl"} lg:text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}
