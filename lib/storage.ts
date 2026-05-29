import type { AuthUser, Reservation } from "./types";

const AUTH_KEY = "sintetica.auth";
const RESERVATIONS_KEY = "sintetica.reservations";

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function getAuth(): AuthUser | null {
  if (typeof window === "undefined") return null;
  return safeJsonParse<AuthUser>(localStorage.getItem(AUTH_KEY));
}

export function setAuth(user: AuthUser) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export function listReservations(): Reservation[] {
  if (typeof window === "undefined") return [];
  const res = safeJsonParse<Reservation[]>(localStorage.getItem(RESERVATIONS_KEY));
  return Array.isArray(res) ? res : [];
}

export function addReservation(reservation: Reservation) {
  const existing = listReservations();
  existing.unshift(reservation);
  localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(existing));
}

export function deleteReservation(reservationId: string) {
  const existing = listReservations();
  const next = existing.filter((r) => r.id !== reservationId);
  localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(next));
}

