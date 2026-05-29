"use client";

import { useRouter } from "next/navigation";
import { FiUser, FiPhone, FiMail, FiCalendar, FiSave, FiLoader, FiCheckCircle } from "react-icons/fi";
import { Button } from "../../components/Button";
import { useProfile } from "../../hooks/useProfile";

export default function ProfilePage() {
  const router = useRouter();
  const {
    username, setUsername,
    phone, setPhone,
    email,
    role,
    loading,
    saving,
    error, setError,
    success,
    updateProfile,
  } = useProfile();

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    await updateProfile();
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-3">
          <FiLoader className="animate-spin text-4xl text-secondary" />
          <span className="text-sm font-medium text-zinc-600">Cargando perfil...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-zinc-50 to-zinc-100 pt-28 pb-12 px-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center sm:text-left">
          <h1 className="text-3xl font-black tracking-tight text-on-background">Mi Perfil</h1>
          <p className="mt-2 text-zinc-600">
            Gestiona tus datos personales de contacto para tus reservas de cancha.
          </p>
        </div>

        {/* Form Container */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-soft">
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <FiCheckCircle className="text-lg" />
                {success}
              </div>
            )}

            {/* Email Field (Disabled) */}
            <div>
              <label className="block text-sm font-bold text-zinc-700">Correo Electrónico</label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-500">
                <FiMail className="text-zinc-400" />
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full bg-transparent text-sm outline-none cursor-not-allowed"
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500">El correo electrónico no puede ser modificado.</p>
            </div>

            {/* Username Field */}
            <div>
              <label className="block text-sm font-bold text-zinc-700">Nombre de Usuario</label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 focus-within:border-secondary transition-colors">
                <FiUser className="text-zinc-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Tu nombre completo o usuario"
                  className="w-full bg-transparent text-sm outline-none"
                  required
                />
              </div>
            </div>

            {/* Phone Field */}
            <div>
              <label className="block text-sm font-bold text-zinc-700">Teléfono (WhatsApp)</label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 focus-within:border-secondary transition-colors">
                <FiPhone className="text-zinc-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: 3186025827"
                  className="w-full bg-transparent text-sm outline-none"
                  required
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500">Este número es crucial para confirmar tus reservas.</p>
            </div>

            {/* Role indicator if admin */}
            {role === "admin" && (
              <div className="rounded-2xl bg-secondary/5 border border-secondary/10 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-secondary">
                  <span>Rol de Cuenta: Administrador</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-zinc-100">
              <Button
                type="button"
                onClick={() => router.push("/reservas")}
                className="border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
              >
                <FiCalendar /> Ver Mis Reservas
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <FiLoader className="animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <FiSave /> Guardar Cambios
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
