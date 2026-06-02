'use client';

import { useEffect, useRef, useState } from 'react';

import { Loader2, X } from 'lucide-react';

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function CameraScanner({ onScan, onClose }: Props) {
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState('');

  // ID único por instancia — evita el conflicto cuando React monta el efecto dos veces (Strict Mode)
  const containerIdRef = useRef(`qr-${Math.random().toString(36).slice(2)}`);
  const scannerRef     = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const calledRef      = useRef(false);
  const mountedRef     = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    calledRef.current  = false;

    async function start() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');

        // Limpiar cualquier instancia previa en el mismo contenedor
        try {
          const stale = new Html5Qrcode(containerIdRef.current);
          await stale.stop().catch(() => {});
          stale.clear();
        } catch { /* no había instancia previa, ignorar */ }

        const scanner = new Html5Qrcode(containerIdRef.current);
        scannerRef.current = scanner as unknown as typeof scannerRef.current;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (text) => {
            if (!mountedRef.current || calledRef.current) return;
            calledRef.current = true;
            scanner.stop().catch(() => {}).finally(() => {
              if (mountedRef.current) onScan(text);
            });
          },
          // Callback de error por frame: son normales durante el escaneo, suprimir
          () => {}
        );

        if (mountedRef.current) setStatus('scanning');

      } catch (err: unknown) {
        if (!mountedRef.current) return;

        // Distinguir errores de permiso de otros errores
        const msg = err instanceof Error ? err.message : String(err ?? '');
        const isPermission =
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('notallowed') ||
          msg.toLowerCase().includes('denied');

        setStatus('error');
        setErrorMsg(
          isPermission
            ? 'Permiso de cámara denegado. Habilitalo en la configuración del navegador.'
            : 'No se pudo iniciar la cámara. Probá cerrando y volviendo a abrir.'
        );
      }
    }

    start();

    return () => {
      mountedRef.current = false;
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {}).finally(() => { try { s.clear(); } catch { /* noop */ } });
        scannerRef.current = null;
      }
    };
  // onScan es estable (useCallback en el padre), incluirlo no causa re-runs
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Escanear con cámara</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenedor del scanner — ID único */}
        <div className="relative bg-black" style={{ minHeight: 300 }}>
          <div id={containerIdRef.current} className="w-full" />

          {status === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Iniciando cámara…</p>
            </div>
          )}
        </div>

        {status === 'error' && (
          <div className="px-4 py-4 text-center">
            <p className="text-sm text-red-600">{errorMsg}</p>
            <button
              onClick={onClose}
              className="mt-3 text-sm font-medium text-blue-600 hover:underline"
            >
              Cerrar
            </button>
          </div>
        )}

        {status === 'scanning' && (
          <p className="px-4 py-3 text-center text-xs text-slate-500">
            Apuntá la cámara al código de barras o QR
          </p>
        )}
      </div>
    </div>
  );
}
