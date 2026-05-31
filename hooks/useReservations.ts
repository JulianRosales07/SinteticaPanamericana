"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { ReservationRepository } from "../lib/core/repositories/reservation.repository";

export function useReservations() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const reservationRepo = useMemo(() => new ReservationRepository(supabase), [supabase]);

  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "all">("active");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login?redirect=/reservas");
      return;
    }

    try {
      const data = await reservationRepo.getReservationsByUser(user.id);
      setReservations(data ?? []);
    } catch (err) {
      console.error("Error loading reservations:", err);
    }
    setLoading(false);
  }, [supabase, router, reservationRepo]);

  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(() => {
    load();
  }, [load]);

  const filteredReservations = useMemo(() => {
    const nowStr = new Date().toISOString().slice(0, 10);
    return reservations.filter((r) => {
      if (activeTab === "all") return true;
      return (r.status === "active" || r.status === "pending_payment") && r.date >= nowStr;
    });
  }, [reservations, activeTab]);

  return {
    reservations: filteredReservations,
    allReservations: reservations,
    loading,
    activeTab,
    setActiveTab,
    reload,
  };
}
