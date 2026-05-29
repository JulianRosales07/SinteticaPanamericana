"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { FiMail, FiKey, FiEye, FiEyeOff, FiLoader } from "react-icons/fi";
import { FaGoogle } from "react-icons/fa";
import { z } from "zod";
import { Button } from "../../components/Button";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

const loginSchema = z.object({
  email: z.string().email("Ingresa un correo válido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/";
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onLogin(values: LoginValues) {
    setFormError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setFormError(error.message);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const u = authData.user;
    const { data: profile } = u
      ? await supabase
          .from("profiles")
          .select("role")
          .eq("id", u.id)
          .maybeSingle()
      : { data: null };

    if (profile?.role === "admin") {
      router.push("/admin");
    } else {
      router.push(nextUrl);
    }
  }

  async function onGoogle() {
    setFormError(null);
    const origin = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
      },
    });
    if (error) setFormError(error.message);
  }

  return (
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0 bg-inverse-surface">
        <div
          className="absolute inset-0 opacity-40 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-stadium.jpg')" }}
        />
        <div className="absolute inset-0 bg-linear-to-t from-inverse-surface via-transparent to-transparent" />
        <div className="absolute inset-0 turf-overlay opacity-20" />
      </div>

      {/* Login Container */}
      <div className="relative z-10 w-full max-w-[400px] px-4 md:px-0">
        <div className="glass-panel rounded-xl shadow-xl p-6 md:p-8 flex flex-col items-center">
          {/* Brand Identity */}
          <div className="mb-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-primary-container flex items-center justify-center hover:scale-105 transition-transform duration-300">
              <span className="material-symbols-outlined text-3xl text-on-primary-container">sports_soccer</span>
            </div>
            <h1 className="text-2xl font-bold text-inverse-surface tracking-tight">Bienvenido</h1>
            <p className="text-on-surface-variant text-sm mt-1">Accede a tu cuenta deportiva</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onLogin)} className="w-full space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                Correo Electrónico
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                  <FiMail className="text-base" />
                </span>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="nombre@ejemplo.com"
                  className="w-full h-10 pl-10 pr-4 rounded-lg border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm text-on-surface"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-error font-semibold">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                Contraseña
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                  <FiKey className="text-base" />
                </span>
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full h-10 pl-10 pr-10 rounded-lg border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm text-on-surface"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary"
                >
                  {showPassword ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-error font-semibold">{errors.password.message}</p>
              )}
            </div>

            {formError && (
              <div className="rounded-lg border border-error/20 bg-error-container/20 p-3 text-xs text-error font-semibold">
                {formError}
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-primary-container text-on-primary-container font-bold text-sm rounded-lg shadow-sm hover:shadow-md hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">login</span>
              {isSubmitting ? "Ingresando..." : "Iniciar Sesión"}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-4 flex items-center gap-3 w-full">
            <div className="h-px flex-1 bg-outline-variant/30" />
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider">o continúa con</span>
            <div className="h-px flex-1 bg-outline-variant/30" />
          </div>

          {/* Google Button */}
          <button
            type="button"
            onClick={onGoogle}
            className="w-full flex items-center justify-center gap-3 bg-surface-container-lowest hover:bg-surface-container text-on-surface font-bold py-3 px-4 rounded-lg transition-all shadow-sm border border-outline-variant/30 text-sm"
          >
            <FaGoogle className="text-lg text-red-600" />
            <span>Continuar con Google</span>
          </button>

          {/* Footer */}
          <div className="mt-6 pt-5 border-t border-outline-variant w-full text-center">
            <p className="text-sm text-on-surface-variant">
              ¿No tienes una cuenta?{" "}
              <Link href="/registro" className="text-primary font-bold hover:underline decoration-2 underline-offset-4 ml-1">
                Regístrate ahora
              </Link>
            </p>
          </div>
        </div>

        {/* Subtle footer accent */}
        <div className="mt-8 flex justify-center opacity-30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-surface-variant">sports_soccer</span>
            <span className="w-8 h-1 bg-surface-variant rounded-full" />
            <span className="material-symbols-outlined text-surface-variant">stadium</span>
            <span className="w-8 h-1 bg-surface-variant rounded-full" />
            <span className="material-symbols-outlined text-surface-variant">emoji_events</span>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-inverse-surface">
        <FiLoader className="animate-spin text-3xl text-primary" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
