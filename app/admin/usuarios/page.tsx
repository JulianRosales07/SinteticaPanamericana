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
        <FiLoader className="animate-spin text-3xl text-red-700" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Usuarios</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Gestión de perfiles (usuario/teléfono/rol).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, teléfono, rol o id..."
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none md:w-[360px]"
          />
          <Button type="button" onClick={load}>
            <FiRefreshCw /> Recargar
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-zinc-200">
        <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-5 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-600">
          <div className="col-span-3">Usuario</div>
          <div className="col-span-3">Teléfono</div>
          <div className="col-span-2">Rol</div>
          <div className="col-span-2">Creado</div>
          <div className="col-span-2">Id</div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-zinc-600">
            Sin resultados.
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 bg-white">
            {filtered.map((r) => (
              <div key={r.id} className="grid grid-cols-12 items-center gap-2 px-5 py-4 text-sm">
                <div className="col-span-3">
                  <input
                    defaultValue={r.username ?? ""}
                    placeholder="(sin nombre)"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (r.username ?? "")) updateProfile(r.id, { username: v });
                    }}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm outline-none"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    defaultValue={r.phone ?? ""}
                    placeholder="(sin teléfono)"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (r.phone ?? "")) updateProfile(r.id, { phone: v });
                    }}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <select
                    value={r.role}
                    onChange={(e) => updateProfile(r.id, { role: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm outline-none"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div className="col-span-2 text-xs text-zinc-600">
                  {new Date(r.created_at).toLocaleString("es-CO")}
                </div>
                <div className="col-span-2 font-mono text-[11px] text-zinc-500">
                  {r.id}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

