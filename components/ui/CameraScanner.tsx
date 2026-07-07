'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';

interface Props {
  onScan:  (code: string) => void;
  onClose: () => void;
}

export default function CameraScanner({ onScan, onClose }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; });

  const [error,    setError]    = useState<string | null>(null);
  const [hint,     setHint]     = useState('Iniciando cámara…');
  const [focusing, setFocusing] = useState(false);
  const [tapRing,  setTapRing]  = useState<{ x: number; y: number } | null>(null);
  const [zoom,     setZoom]     = useState(1);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number } | null>(null);

  // Cerrar teclado al montar — blur inmediato y con delay por si Android lo reabre
  useEffect(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    const t = setTimeout(() => (document.activeElement as HTMLElement | null)?.blur(), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let stopped = false;
    let stopFn: (() => void) | null = null;

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (stopped) return;

        const reader = new BrowserMultiFormatReader();

        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current!,
          (result) => {
            if (stopped || !result) return;
            stopped = true;
            onScanRef.current(result.getText());
          }
        );

        stopFn = () => controls.stop();
        if (stopped) { controls.stop(); return; }

        // Configurar foco y zoom según capacidades del dispositivo
        const video = videoRef.current;
        if (video?.srcObject instanceof MediaStream) {
          const [track] = (video.srcObject as MediaStream).getVideoTracks();
          if (track) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const caps = (track as any).getCapabilities?.() ?? {};

              // Detectar si soporta zoom (Android principalmente)
              if (caps.zoom) {
                setZoomCaps({ min: caps.zoom.min ?? 1, max: Math.min(caps.zoom.max ?? 8, 8) });
              }

              // Intentar macro: focusDistance al mínimo + continuous
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const advanced: Record<string, any> = {};
              if (caps.focusMode?.includes?.('continuous')) {
                advanced.focusMode = 'continuous';
              }
              if (caps.focusDistance) {
                // focusDistance en metros; min = más cerca (macro)
                advanced.focusMode    = 'manual';
                advanced.focusDistance = caps.focusDistance.min ?? 0;
              }
              if (Object.keys(advanced).length > 0) {
                await track.applyConstraints({ advanced: [advanced] });
              }
            } catch { /* capacidad no soportada */ }
          }
        }

        setHint('Apuntá al código · tocá para enfocar');
      } catch (e: unknown) {
        if (stopped) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(
          msg.includes('ermission') || msg.includes('NotAllowed') || msg.includes('Denied')
            ? 'Permiso de cámara denegado. Habilitalo en Ajustes.'
            : 'No se pudo acceder a la cámara.'
        );
      }
    }

    start();
    return () => { stopped = true; stopFn?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getTrack(): MediaStreamTrack | null {
    const video = videoRef.current;
    if (!video?.srcObject || !(video.srcObject instanceof MediaStream)) return null;
    return (video.srcObject as MediaStream).getVideoTracks()[0] ?? null;
  }

  async function tryFocus(mode: string) {
    const track = getTrack();
    if (!track) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caps = (track as any).getCapabilities?.() ?? {};
      if (caps.focusMode?.includes?.(mode)) {
        await track.applyConstraints({ advanced: [{ focusMode: mode } as never] });
      }
    } catch { /* no soportado */ }
  }

  // Tap-to-focus: ciclo auto → continuous
  async function handleTap(e: React.PointerEvent<HTMLVideoElement>) {
    e.preventDefault();
    if (focusing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTapRing({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setTimeout(() => setTapRing(null), 700);
    setFocusing(true);
    setHint('Enfocando…');
    await tryFocus('auto');
    await new Promise(r => setTimeout(r, 500));
    await tryFocus('continuous');
    setFocusing(false);
    setHint('Apuntá al código · tocá para enfocar');
  }

  async function changeZoom(delta: number) {
    if (!zoomCaps) return;
    const next = Math.min(zoomCaps.max, Math.max(zoomCaps.min, parseFloat((zoom + delta).toFixed(1))));
    const track = getTrack();
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: next } as never] });
      setZoom(next);
    } catch { /* no soportado */ }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-base font-semibold">Escanear código de barras</p>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 active:bg-white/20">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Video / error */}
      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="text-white/80">{error}</p>
            <button onClick={onClose} className="rounded-xl bg-white/20 px-6 py-2.5 text-sm font-semibold text-white">Cerrar</button>
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              style={{ touchAction: 'none' }}
              playsInline
              autoPlay
              muted
              onPointerDown={handleTap}
            />

            {/* Anillo visual tap-to-focus */}
            {tapRing && (
              <div
                className="pointer-events-none absolute rounded-full border-2 border-yellow-300"
                style={{ width: 64, height: 64, left: tapRing.x - 32, top: tapRing.y - 32, animation: 'ping 0.6s ease-out forwards' }}
              />
            )}

            {/* Mira */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div
                className="absolute inset-0 bg-black/50"
                style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 12% 25%, 12% 75%, 88% 75%, 88% 25%, 12% 25%)' }}
              />
              <div className="relative h-44 w-72 rounded-xl">
                {[
                  'top-0 left-0 border-t-4 border-l-4 rounded-tl-xl',
                  'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl',
                  'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl',
                  'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl',
                ].map((cls, i) => (
                  <span key={i} className={`absolute h-6 w-6 border-primary-400 ${cls}`} />
                ))}
                <span className="absolute inset-x-4 h-0.5 rounded-full bg-primary-400 shadow-[0_0_8px_2px_rgba(99,102,241,0.6)] animate-[scan_2s_ease-in-out_infinite]" />
              </div>
              <p className="mt-4 text-sm text-white/70">{hint}</p>
            </div>

            {/* Control de zoom — solo aparece si el dispositivo lo soporta */}
            {zoomCaps && (
              <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-5">
                <button
                  onPointerDown={(e) => { e.preventDefault(); changeZoom(-0.5); }}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white active:bg-black/80"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <span className="w-14 text-center text-base font-bold text-white tabular-nums">
                  {zoom.toFixed(1)}×
                </span>
                <button
                  onPointerDown={(e) => { e.preventDefault(); changeZoom(+0.5); }}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white active:bg-black/80"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
