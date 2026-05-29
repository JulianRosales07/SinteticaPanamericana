import type { CanchaId } from "./types";

/**
 * Precios base (COP). Luego esto se puede mover a BD + panel admin de precios.
 */
export const PRICES = {
  morning: {
    1: 80000,
    2: 80000,
  } satisfies Record<CanchaId, number>,
  night: {
    1: 100000,
    2: 100000,
  } satisfies Record<CanchaId, number>,
};

/**
 * Número de WhatsApp del administrador (para que el cliente lo contacte).
 * Recomendado: usar formato con indicativo, p.ej: +573001234567 o 573001234567.
 */
export const ADMIN_WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER ?? "";

/**
 * Mañana: 06:00–17:59 (hour < 18)
 * Noche:  18:00–23:00 (hour >= 18)
 */
export function getPrice(cancha: CanchaId, hour: number) {
  const band = hour < 18 ? "morning" : "night";
  return PRICES[band][cancha];
}
