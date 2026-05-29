import crypto from "crypto";

export type WompiEnv = "sandbox" | "production";

export function getWompiEnv(): WompiEnv {
  const v = (process.env.NEXT_PUBLIC_WOMPI_ENV ?? "sandbox").toLowerCase();
  return v === "production" ? "production" : "sandbox";
}

export function getWompiPublicKey() {
  const env = getWompiEnv();
  return env === "production"
    ? process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY_PROD
    : process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY_TEST;
}

export function getWompiIntegritySecret() {
  const env = getWompiEnv();
  return env === "production"
    ? process.env.WOMPI_INTEGRITY_SECRET_PROD
    : process.env.WOMPI_INTEGRITY_SECRET_TEST;
}

export function getWompiEventsSecret() {
  const env = getWompiEnv();
  return env === "production"
    ? process.env.WOMPI_EVENTS_SECRET_PROD
    : process.env.WOMPI_EVENTS_SECRET_TEST;
}

export function getWompiApiBaseUrl(env: WompiEnv) {
  return env === "production"
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";
}

export function getWompiCheckoutBaseUrl() {
  return "https://checkout.wompi.co/p/";
}

export function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Firma de integridad (Checkout Web) según Wompi:
 * "<Reference><AmountInCents><Currency><IntegritySecret>"
 */
export function createIntegritySignature(params: {
  reference: string;
  amountInCents: number;
  currency: "COP";
  integritySecret: string;
}) {
  const concat = `${params.reference}${params.amountInCents}${params.currency}${params.integritySecret}`;
  return sha256Hex(concat);
}

