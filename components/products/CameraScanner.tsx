'use client';

import { Component, useEffect, useRef, useState, type ReactNode } from 'react';

import { Loader2, X } from 'lucide-react';

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
}

// ─── Error Boundary local ─────────────────────────────────────
interface BoundaryState { hasError: boolean }

class CameraErrorBoundary extends Component<
  { onClose: () => void; children: ReactNode },
  BoundaryState
> {
  constructor(props: { onClose: () => void; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    console.warn('[CameraScanner] error capturado:', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
            <p className="text-sm text-red-600 mb-4">
              No se pudo iniciar la cámara. Verificá los permisos del navegador.
            </p>
            <button onClick={this.props.onClose} className="text-sm font-medium text-primary-700 hover:underline">
              Cerrar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Scanner interno ──────────────────────────────────────────
function ScannerInner({ onScan, onClose }: Props) {
  const [status, setStatus]     = useState<'starting' | 'scanning' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState('');
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
        try {
          const stale = new Html5Qrcode(containerIdRef.current);
          await stale.stop().catch(() => {});
          stale.clear();
        } catch { /* no habia instancia previa */ }

        const scanner = new Html5Qrcode(containerIdRef.current);
        scannerRef.current = scanner as unknown as typeof scannerRef.current;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (text: string) => {
            if (!mountedRef.current || calledRef.current) return;
            calledRef.current = true;
            scanner.stop().catch(() => {}).finally(() => {
              if (mountedRef.current) onScan(text);
            });
          },
          () => {}
        );
        if (mountedRef.current) setStatus('scanning');
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        const msg = err instanceof Error ? err.message : String(err ?? '');
        const denied = /permission|notallowed|denied/i.test(msg);
        setStatus('error');
        setErrorMsg(denied
          ? 'Permiso de camara denegado. Habilitalo en la configuracion del navegador.'
          : 'No se pudo iniciar la camara. Cerra y volvé a intentar.');
      }
    }

    start();

    return () => {
      mountedRef.current = false;
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {}).finally(() => { try { s.clear(); } catch { /**/ } });
        scannerRef.current = null;
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Escanear con camara</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative bg-black" style={{ minHeight: 300 }}>
          <div id={containerIdRef.current} className="w-full" />
          {status === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Iniciando camara...</p>
            </div>
          )}
        </div>
        {status === 'error' && (
          <div className="px-4 py-4 text-center">
            <p className="text-sm text-red-600">{errorMsg}</p>
            <button onClick={onClose} className="mt-3 text-sm font-medium text-primary-700 hover:underline">Cerrar</button>
          </div>
        )}
        {status === 'scanning' && (
          <p className="px-4 py-3 text-center text-xs text-slate-500">Apunta la camara al codigo de barras o QR</p>
        )}
      </div>
    </div>
  );
}

// ─── Export: scanner con boundary propio ─────────────────────
export function CameraScanner({ onScan, onClose }: Props) {
  return (
    <CameraErrorBoundary onClose={onClose}>
      <ScannerInner onScan={onScan} onClose={onClose} />
    </CameraErrorBoundary>
  );
}
