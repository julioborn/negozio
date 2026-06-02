'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error.message);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: 24,
            padding: 24,
            background: '#f8fafc',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#fee2e2', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 28,
            }}
          >
            ⚠
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
              Error crítico de la aplicación
            </h1>
            <p style={{ fontSize: 14, color: '#64748b', maxWidth: 360, margin: 0 }}>
              La aplicación encontró un error que no pudo recuperarse automáticamente.
            </p>
          </div>
          <button
            onClick={reset}
            style={{
              background: '#1700a5', color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px 24px',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
