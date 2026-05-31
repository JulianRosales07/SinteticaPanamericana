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

export function getWompiPrivateKey() {
  const env = getWompiEnv();
  return env === "production"
    ? process.env.WOMPI_PRIVATE_KEY_PROD
    : process.env.WOMPI_PRIVATE_KEY_TEST;
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


/**
 * Void (anular) una transacción aprobada en Wompi.
 * Solo aplica para transacciones con tarjeta.
 * Endpoint: POST /v1/transactions/{transaction_id}/void
 */
export async function voidTransaction(transactionId: string): Promise<{
  success: boolean;
  status?: string;
  error?: string;
}> {
  const privateKey = getWompiPrivateKey();
  if (!privateKey) {
    return { success: false, error: "Falta configurar WOMPI_PRIVATE_KEY en el servidor." };
  }

  const env = getWompiEnv();
  const baseUrl = getWompiApiBaseUrl(env);
  const url = `${baseUrl}/transactions/${transactionId}/void`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${privateKey}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        status: data?.data?.status ?? "VOIDED",
      };
    }

    return {
      success: false,
      error: data?.error?.message ?? data?.message ?? `Wompi respondió con status ${response.status}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message ?? "Error de red al contactar Wompi",
    };
  }
}
