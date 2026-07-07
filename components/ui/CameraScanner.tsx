'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  onScan:  (code: string) => void;
  onClose: () => void;
}

export default function CameraScanner({ onScan, onClose }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  // Ref para onScan — evita que el effect se reinicie en cada render
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; });

  const [error, setError] = useState<string | null>(null);
  const [hint,  setHint]  = useState('Iniciando cámara…');

  useEffect(() => {
    let stopped = false;
    let stopFn: (() => void) | null = null;

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (stopped) return;

        const reader = new BrowserMultiFormatReader();
        setHint('Apuntá al código de barras');

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

        // Forzar autofocus continuo en Android (muchos dispositivos lo soportan pero no lo activan por defecto)
        const video = videoRef.current;
        if (video?.srcObject instanceof MediaStream) {
          const [track] = (video.srcObject as MediaStream).getVideoTracks();
          if (track) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const caps = (track as any).getCapabilities?.() ?? {};
              if (caps.focusMode?.includes?.('continuous')) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
              }
            } catch { /* no soportado en este dispositivo, ignorar */ }
          }
        }
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

    // El effect corre una sola vez — onScan llega por ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              playsInline
              autoPlay
              muted
            />

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
