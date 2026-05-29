"use client";

import Link from "next/link";

const cards = [
  {
    title: "Reservas",
    desc: "Ver, cancelar, confirmar y marcar asistencia. WhatsApp al cliente.",
    href: "/admin/reservas",
    icon: "calendar_month",
    accent: "secondary",
  },
  {
    title: "Facturas",
    desc: "Ver facturas, buscar por cliente y actualizar el estado de pago.",
    href: "/admin/facturas",
    icon: "receipt_long",
    accent: "secondary",
  },
  {
    title: "Precios y canchas",
    desc: "CRUD de reglas de precios y nombres de canchas.",
    href: "/admin/precios",
    icon: "attach_money",
    accent: "on-tertiary-container",
  },
  {
    title: "Usuarios",
    desc: "Ver y actualizar datos (usuario/teléfono/rol).",
    href: "/admin/usuarios",
    icon: "group",
    accent: "secondary",
  },
  {
    title: "Productos",
    desc: "Inventario: nombre, cantidad, precio. CRUD completo.",
    href: "/admin/productos",
    icon: "inventory_2",
    accent: "on-tertiary-container",
  },
  {
    title: "Ventas",
    desc: "Registrar ventas y descontar inventario.",
    href: "/admin/ventas",
    icon: "point_of_sale",
    accent: "secondary",
  },
  {
    title: "Cuadre de caja",
    desc: "Total vendido y diferencia vs. efectivo contado.",
    href: "/admin/cuadre",
    icon: "account_balance_wallet",
    accent: "on-tertiary-container",
  },
];

export default function AdminHomePage() {
  return (
    <div className="space-y-10">
      {/* Welcome banner */}
      <div className="glass-card rounded-3xl border border-outline-variant/30 p-8 shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-on-primary-container">dashboard</span>
          </div>
          <div>
            <h2 className="text-3xl font-black text-on-surface tracking-tight">
              Panel de Administración
            </h2>
            <p className="text-lg text-on-surface-variant mt-1">
              Gestiona todas las operaciones desde un solo lugar
            </p>
          </div>
        </div>
      </div>

      {/* Card grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group glass-card flex flex-col rounded-3xl border border-outline-variant/30 p-7 shadow-lg hover:shadow-2xl transition-all hover:scale-105 hover:border-primary/40"
          >
            {/* Icon */}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-${c.accent === "secondary" ? "secondary" : "tertiary"}-container/20 border border-outline-variant/20 group-hover:scale-110 transition-transform`}>
              <span
                className={`material-symbols-outlined text-3xl text-${c.accent} group-hover:scale-110 transition-transform`}
                data-icon={c.icon}
              >
                {c.icon}
              </span>
            </div>
            <div className="text-xl font-black text-on-surface group-hover:text-primary transition-colors mb-3">
              {c.title}
            </div>
            <p className="text-sm text-on-surface-variant flex-grow leading-relaxed">{c.desc}</p>
            <div className="mt-5 flex items-center gap-2 text-sm font-bold text-primary">
              Abrir módulo
              <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform" data-icon="arrow_forward">
                arrow_forward
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
