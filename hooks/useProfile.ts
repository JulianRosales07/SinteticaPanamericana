"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { ProfileRepository } from "../lib/core/repositories/profile.repository";

export function useProfile() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const profileRepo = useMemo(() => new ProfileRepository(supabase), [supabase]);

  const [authUser, setAuthUser] = useState<any | null>(null);
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?redirect=/perfil");
        return;
      }

      setAuthUser(user);
      setEmail(user.email ?? "");

      try {
        const profile = await profileRepo.getProfile(user.id);
        if (profile) {
          setUsername(profile.username ?? "");
          setPhone(profile.phone ?? "");
          setRole(profile.role ?? "user");
        }
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    }

    load();
  }, [supabase, router, profileRepo]);

  const updateProfile = useCallback(async () => {
    if (!username.trim()) {
      setError("El nombre de usuario no puede estar vacío.");
      return false;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      setError("Por favor ingresa un número de teléfono válido.");
      return false;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await profileRepo.updateProfile(authUser.id, {
        username: username.trim(),
        phone: phone.trim(),
      });
      setSuccess("¡Perfil actualizado correctamente!");
      setTimeout(() => setSuccess(null), 3000);
      setSaving(false);
      return true;
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
      return false;
    }
  }, [authUser, username, phone, profileRepo]);

  return {
    authUser,
    username, setUsername,
    phone, setPhone,
    email,
    role,
    loading,
    saving,
    error, setError,
    success,
    updateProfile,
  };
}
