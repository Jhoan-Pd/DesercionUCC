"use client";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export default function ErrorApp({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-10">
      <Alert variant="error" titulo="Algo salió mal">
        No pudimos cargar esta sección. Si el problema persiste, verifica la conexión con la base de datos o contacta al administrador.
        {error.digest && <span className="mt-1 block text-xs opacity-70">Código: {error.digest}</span>}
      </Alert>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
