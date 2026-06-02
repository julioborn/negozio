import type { Metadata } from 'next';
import Link from 'next/link';

import { ShieldX } from 'lucide-react';

export const metadata: Metadata = { title: '403 — Acceso denegado | Negozio' };

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 mb-5">
        <ShieldX className="h-8 w-8 text-red-600" />
      </div>

      <h1 className="text-3xl font-bold text-slate-900">Acceso denegado</h1>
      <p className="mt-3 max-w-sm text-slate-500">
        No tenés permisos para ver esta página. Si creés que es un error, contactá al
        administrador.
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="
            rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white
            transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2
            focus:ring-blue-500 focus:ring-offset-2
          "
        >
          Ir al inicio
        </Link>
        <Link
          href="/login"
          className="
            rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold
            text-slate-700 transition-colors hover:bg-slate-50
            focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2
          "
        >
          Iniciar sesión
        </Link>
      </div>

      <p className="mt-4 text-xs text-slate-400">Código de error: 403 Forbidden</p>
    </main>
  );
}
