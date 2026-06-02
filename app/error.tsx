'use client';

import { useEffect } from 'react';

import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

import { translateSupabaseError } from '@/lib/utils/errors';

export default function ErrorPage({
  error,
  reset,
}: {
  // El error puede llegar como objeto no-estándar desde librerías como html5-qrcode
  error: unknown;
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ErrorBoundary]', error);
  }, [error]);

  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : null;

  const digest =
    error instanceof Error && 'digest' in error
      ? String((error as Error & { digest?: string }).digest ?? '')
      : '';

  const message = translateSupabaseError(rawMessage);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-100">
        <AlertTriangle className="h-8 w-8 text-danger-600" />
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Algo salió mal</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">{message}</p>
        {digest && (
          <p className="mt-2 font-mono text-xs text-slate-400">Ref: {digest}</p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2.5
                     text-sm font-semibold text-white hover:bg-primary-800"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
        <a
          href="/"
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4
                     py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Home className="h-4 w-4" />
          Inicio
        </a>
      </div>
    </main>
  );
}
