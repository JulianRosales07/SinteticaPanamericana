function onlyDigits(value: string) {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Normaliza un teléfono para enlaces wa.me
 * - elimina caracteres no numéricos
 * - si tiene 10 dígitos, asume Colombia (+57) y lo prefija
 * Retorna solo dígitos (sin "+").
 */
export function normalizeWhatsAppNumber(phone: string) {
  const digits = onlyDigits(phone);
  if (digits.length === 10) return `57${digits}`;
  return digits;
}

export function createWhatsAppUrl(params: { phone: string; text: string }) {
  const number = normalizeWhatsAppNumber(params.phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(params.text)}`;
}

