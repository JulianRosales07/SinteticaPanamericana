import { Suspense } from "react";
import ResultClient from "./ResultClient";

export const dynamic = "force-dynamic";

export default function PagoResultadoPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white px-6 py-16">
          <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="text-sm text-zinc-600">Cargando…</div>
          </div>
        </div>
      }
    >
      <ResultClient />
    </Suspense>
  );
}
