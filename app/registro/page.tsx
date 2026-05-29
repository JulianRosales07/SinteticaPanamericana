"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { FiUser, FiMail, FiPhone, FiKey, FiEye, FiEyeOff, FiArrowRight } from "react-icons/fi";
import { FaGoogle, FaFacebook } from "react-icons/fa";
import { z } from "zod";
import { Button } from "../../components/Button";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

const registerSchema = z.object({
  username: z.string().min(3, "Ingresa un nombre de usuario"),
  phone: z
    .string()
    .min(7, "Ingresa un número de teléfono válido")
    .max(20, "Ingresa un número de teléfono válido"),
  email: z.string().email("Ingresa un correo válido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegistroPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", phone: "", email: "", password: "" },
  });

  async function onRegister(values: RegisterValues) {
    setFormError(null);

    if (!acceptTerms) {
      setFormError("Debes aceptar los términos y condiciones.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          username: values.username,
          phone: values.phone,
        },
      },
    });
    if (error) {
      setFormError(error.message);
      return;
    }
    router.push("/login?registered=true");
  }

  async function onGoogle() {
    setFormError(null);
    const origin = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/`,
      },
    });
    if (error) setFormError(error.message);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background igual al login */}
      <div className="absolute inset-0 z-0 bg-inverse-surface">
        <div
          className="absolute inset-0 opacity-40 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-stadium.jpg')" }}
        />
        <div className="absolute inset-0 bg-linear-to-t from-inverse-surface via-transparent to-transparent" />
        <div className="absolute inset-0 turf-overlay opacity-20" />
      </div>

      <div className="relative z-10 w-full max-w-4xl flex flex-col md:flex-row bg-white rounded-xl shadow-xl overflow-hidden min-h-[550px]">
        
        {/* Left Side: Branding */}
        <section className="hidden md:flex md:w-1/2 relative bg-inverse-surface items-center justify-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div
              className="w-full h-full bg-cover bg-center opacity-60"
              style={{ backgroundImage: "url('/hero-stadium.jpg')" }}
            />
            <div className="absolute inset-0 bg-linear-to-tr from-primary/40 to-transparent" />
          </div>

          <div className="relative z-10 p-8 flex flex-col items-center text-center space-y-4">
            <div className="w-32 h-32 rounded-full bg-primary-container/20 backdrop-blur-sm flex items-center justify-center">
              <span className="material-symbols-outlined text-6xl text-primary-fixed">sports_soccer</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl text-primary-fixed italic font-black leading-tight">
                DOMINA LA CANCHA
              </h1>
              <p className="text-sm text-primary-fixed/90 max-w-xs mx-auto font-semibold">
                Únete a la comunidad deportiva más grande de la región y reserva en segundos.
              </p>
            </div>

            <div className="flex gap-3 mt-4">
              <span className="bg-primary-container text-on-primary-container px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Canchas Disponibles
              </span>
              <span className="glass-effect text-white px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1 border border-white/20">
                <span className="material-symbols-outlined text-[14px]">bolt</span>
                Reserva Inmediata
              </span>
            </div>
          </div>
        </section>

        {/* Right Side: Registration Form */}
        <section className="w-full md:w-1/2 p-6 md:p-8 flex flex-col justify-center bg-surface-container-lowest">
          <div className="max-w-sm mx-auto w-full">
            {/* Mobile Header */}
            <div className="md:hidden flex flex-col items-center mb-6">
              <div className="w-16 h-16 mb-3 rounded-full bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-on-primary-container">sports_soccer</span>
              </div>
              <h2 className="text-xl font-bold text-primary">Crea tu cuenta</h2>
            </div>

            {/* Desktop Header */}
            <div className="hidden md:block mb-5">
              <h2 className="text-2xl font-bold text-on-surface">Registro de Usuario</h2>
              <p className="text-on-surface-variant text-sm mt-1">Completa tus datos para empezar a jugar.</p>
            </div>

            <form onSubmit={handleSubmit(onRegister)} className="space-y-3.5">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                  Nombre Completo
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                    <FiUser className="text-base" />
                  </span>
                  <input
                    {...register("username")}
                    placeholder="Ej. Juan Pérez"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-container rounded-lg border border-transparent focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm text-on-surface"
                  />
                </div>
                {errors.username && (
                  <p className="text-xs text-error font-semibold">{errors.username.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                    <FiMail className="text-base" />
                  </span>
                  <input
                    {...register("email")}
                    type="email"
                    placeholder="tu@correo.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-container rounded-lg border border-transparent focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm text-on-surface"
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-error font-semibold">{errors.email.message}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                  Teléfono (Para Reservas)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                    <FiPhone className="text-base" />
                  </span>
                  <input
                    {...register("phone")}
                    type="tel"
                    placeholder="+57 300 000 0000"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-container rounded-lg border border-transparent focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm text-on-surface"
                  />
                </div>
                {errors.phone && (
                  <p className="text-xs text-error font-semibold">{errors.phone.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                  Contraseña
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                    <FiKey className="text-base" />
                  </span>
                  <input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-surface-container rounded-lg border border-transparent focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm text-on-surface"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
                  >
                    {showPassword ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-error font-semibold">{errors.password.message}</p>
                )}
              </div>

              {/* Terms */}
              <div className="flex items-start gap-2 py-1">
                <input
                  type="checkbox"
                  id="terms"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-outline text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="terms" className="text-[11px] font-semibold text-on-surface-variant leading-tight cursor-pointer">
                  Acepto los <span className="text-primary font-bold">Términos y Condiciones</span> y la <span className="text-primary font-bold">Política de Privacidad</span>.
                </label>
              </div>

              {formError && (
                <div className="rounded-lg border border-error/20 bg-error-container/20 p-2.5 text-xs text-error font-semibold">
                  {formError}
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-on-primary font-bold py-3 rounded-lg shadow-lg hover:shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 text-sm"
              >
                {isSubmitting ? "Creando..." : "Crear Cuenta"}
                <FiArrowRight className="transition-transform group-hover:translate-x-1" />
              </Button>
            </form>

            {/* Footer Links */}
            <div className="mt-6 text-center space-y-3">
              <p className="text-sm text-on-surface-variant">
                ¿Ya tienes una cuenta?{" "}
                <Link href="/login" className="text-primary font-bold hover:underline ml-1">
                  Inicia Sesión
                </Link>
              </p>

              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-surface-variant" />
                <span className="text-[10px] font-bold text-outline uppercase">O regístrate con</span>
                <div className="flex-1 h-px bg-surface-variant" />
              </div>

              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={onGoogle}
                  className="p-2.5 bg-white border border-outline-variant rounded-full hover:bg-surface-container transition-colors shadow-sm"
                >
                  <FaGoogle className="w-5 h-5 text-red-500" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}