import Link from 'next/link';

import { FileQuestion, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
        <FileQuestion className="h-8 w-8 text-slate-500" />
      </div>

      <div>
        <h1 className="text-5xl font-black text-slate-200">404</h1>
        <h2 className="mt-2 text-xl font-bold text-slate-900">Página no encontrada</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          La página que buscás no existe o fue movida.
        </p>
      </div>

      <Link
        href="/"
        className="flex items-center gap-2 rounded-lg bg-primary-700 px-5 py-2.5
                   text-sm font-semibold text-white hover:bg-primary-800"
      >
        <Home className="h-4 w-4" />
        Volver al inicio
      </Link>
    </main>
  );
}
