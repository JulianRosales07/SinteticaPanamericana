"use client";

import { useEffect, useMemo, useState } from "react";
import { FiLoader, FiRefreshCw } from "react-icons/fi";
import { Button } from "../../../components/Button";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

type ProfileRow = {
  id: string;
  username: string | null;
  phone: string | null;
  role: "user" | "admin" | string;
  created_at: string;
};

export default function AdminUsuariosPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [q, setQ] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, phone, role, created_at")
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    setRows((data ?? []) as ProfileRow[]);
    setIsLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateProfile(id: string, patch: Partial<ProfileRow>) {
    setError(null);
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) return setError(error.message);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const filtered = rows.filter((r) => {
    const hay = `${r.username ?? ""} ${r.phone ?? ""} ${r.role ?? ""} ${r.id}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <FiLoader className="animate-spin text-3xl text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl lg:text-2xl font-black tracking-tight text-on-surface">Usuarios</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Gestión de perfiles ({filtered.length} usuarios)
        </p>
      </div>

      {/* Search + Reload */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-xl">search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, teléfono o rol..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-outline-variant/40 bg-white text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
        <Button type="button" onClick={load} className="shrink-0">
          <FiRefreshCw /> Recargar
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Users List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-outline-variant/30 bg-white p-8 text-center text-sm text-on-surface-variant">
          Sin resultados.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <UserCard key={r.id} profile={r} onUpdate={updateProfile} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── User Card Component ──────────────────────────────────────────────────────

function UserCard({
  profile: r,
  onUpdate,
}: {
  profile: ProfileRow;
  onUpdate: (id: string, patch: Partial<ProfileRow>) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const roleColor = r.role === "admin"
    ? "bg-primary/10 text-primary border-primary/20"
    : "bg-surface-container-high text-on-surface-variant border-outline-variant/20";

  return (
    <div className="bg-white rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden">
      {/* Compact row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-lg text-on-primary-container">person</span>
        </div>

        {/* Name + phone */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-on-surface truncate">
            {r.username || "(sin nombre)"}
          </p>
          <p className="text-xs text-on-surface-variant truncate">
            {r.phone || "(sin teléfono)"}
          </p>
        </div>

        {/* Role badge */}
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border shrink-0 ${roleColor}`}>
          {r.role}
        </span>

        {/* Chevron */}
        <span className={`material-symbols-outlined text-lg text-outline transition-transform ${expanded ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>

      {/* Expanded edit form */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-outline-variant/20 space-y-3">
          {/* Edit fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase font-bold text-outline tracking-wider">Nombre</label>
              <input
                defaultValue={r.username ?? ""}
                placeholder="(sin nombre)"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (r.username ?? "")) onUpdate(r.id, { username: v });
                }}
                className="w-full mt-1 rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-outline tracking-wider">Teléfono</label>
              <input
                defaultValue={r.phone ?? ""}
                placeholder="(sin teléfono)"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (r.phone ?? "")) onUpdate(r.id, { phone: v });
                }}
                className="w-full mt-1 rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase font-bold text-outline tracking-wider">Rol</label>
              <select
                value={r.role}
                onChange={(e) => onUpdate(r.id, { role: e.target.value })}
                className="w-full mt-1 rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-outline tracking-wider">Registrado</label>
              <p className="mt-1 px-3 py-2 text-xs text-on-surface-variant bg-surface-container-low rounded-lg">
                {new Date(r.created_at).toLocaleDateString("es-CO", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {/* ID */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] uppercase font-bold text-outline">ID:</span>
            <span className="font-mono text-[10px] text-on-surface-variant bg-surface-container-low px-2 py-1 rounded truncate">
              {r.id}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
