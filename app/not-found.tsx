import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <p className="text-lg font-semibold">No encontramos esa página</p>
      <Link href="/" className="text-sm font-medium text-primary underline">Volver al inicio</Link>
    </main>
  );
}
