'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  onScan:  (code: string) => void;
  onClose: () => void;
}

export default function CameraScanner({ onScan, onClose }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; });

  const [error,     setError]     = useState<string | null>(null);
  const [hint,      setHint]      = useState('Iniciando cámara…');
  const [focusing,  setFocusing]  = useState(false);
  const [tapRing,   setTapRing]   = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let stopped = false;
    let stopFn: (() => void) | null = null;

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (stopped) return;

        const reader = new BrowserMultiFormatReader();
        setHint('Apuntá al código · tocá para enfocar');

        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' },
              width:      { ideal: 1280 },
              height:     { ideal: 720 },
            },
          },
          videoRef.current!,
          (result) => {
            if (stopped || !result) return;
            stopped = true;
            onScanRef.current(result.getText());
          }
        );

        stopFn = () => controls.stop();
        if (stopped) { controls.stop(); return; }

        // Intentar autofocus continuo al arrancar
        await trySetFocus('continuous');

      } catch (e: unknown) {
        if (stopped) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(
          msg.includes('ermission') || msg.includes('NotAllowed') || msg.includes('Denied')
            ? 'Permiso de cámara denegado. Habilitalo en Ajustes.'
            : 'No se pudo acceder a la cámara.'
        );
      }

      return () => stopFn?.();
    }

    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Obtiene el track de video activo
  function getTrack(): MediaStreamTrack | null {
    const video = videoRef.current;
    if (!video?.srcObject || !(video.srcObject instanceof MediaStream)) return null;
    return (video.srcObject as MediaStream).getVideoTracks()[0] ?? null;
  }

  // Intenta aplicar un modo de foco; silencia errores si no es soportado
  async function trySetFocus(mode: string) {
    const track = getTrack();
    if (!track) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caps = (track as any).getCapabilities?.() ?? {};
      if (caps.focusMode?.includes?.(mode)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await track.applyConstraints({ advanced: [{ focusMode: mode } as any] });
      }
    } catch { /* no soportado */ }
  }

  // Tap-to-focus: ciclo auto → continuous para forzar reenfoque
  async function handleTap(e: React.PointerEvent<HTMLVideoElement>) {
    e.preventDefault(); // evita que Android abra el teclado
    if (focusing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTapRing({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setTimeout(() => setTapRing(null), 700);

    setFocusing(true);
    setHint('Enfocando…');
    await trySetFocus('auto');
    await new Promise(r => setTimeout(r, 400));
    await trySetFocus('continuous');
    setFocusing(false);
    setHint('Apuntá al código · tocá para enfocar');
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-base font-semibold">Escanear código de barras</p>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 active:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Video / error */}
      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="text-white/80">{error}</p>
            <button
              onClick={onClose}
              className="rounded-xl bg-white/20 px-6 py-2.5 text-sm font-semibold text-white"
            >
              Cerrar
            </button>
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

            {/* Anillo de tap-to-focus */}
            {tapRing && (
              <div
                className="pointer-events-none absolute rounded-full border-2 border-yellow-300 opacity-80"
                style={{
                  width: 64, height: 64,
                  left: tapRing.x - 32, top: tapRing.y - 32,
                  animation: 'ping 0.6s ease-out forwards',
                }}
              />
            )}

            {/* Mira */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div
                className="absolute inset-0 bg-black/50"
                style={{
                  clipPath:
                    'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ' +
                    '12% 25%, 12% 75%, 88% 75%, 88% 25%, 12% 25%)',
                }}
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
          </>
        )}
      </div>
    </div>
  );
}
