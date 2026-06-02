'use client';

import dynamic from 'next/dynamic';
import { useCallback, useRef, useState } from 'react';

import { Camera, Loader2, Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';

const CameraScanner = dynamic(
  () => import('@/components/products/CameraScanner').then((m) => m.CameraScanner),
  { ssr: false }
);

type ScanStatus = 'idle' | 'found' | 'not_found';

interface Props {
  onScan: (barcode: string) => void;
  isSearching?: boolean;
  scanStatus?: ScanStatus;
  disabled?: boolean;
}

export function MobileScanner({ onScan, isSearching = false, scanStatus = 'idle', disabled = false }: Props) {
  const [manualValue, setManualValue] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    if (manualValue.trim()) {
      onScan(manualValue.trim());
      setManualValue('');
    }
  }, [manualValue, onScan]);

  const handleCameraScan = useCallback((code: string) => {
    setCameraOpen(false);
    onScan(code);
  }, [onScan]);

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Botón de cámara — protagonista en mobile */}
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          disabled={disabled || isSearching}
          className={cn(
            'flex h-16 w-full items-center justify-center gap-3 rounded-2xl',
            'text-base font-semibold transition-all active:scale-[0.97]',
            scanStatus === 'found'
              ? 'bg-green-600 text-white'
              : scanStatus === 'not_found'
              ? 'bg-red-700 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-500',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {isSearching ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Camera className="h-6 w-6" />
          )}
          {isSearching
            ? 'Buscando…'
            : scanStatus === 'found'
            ? '¡Producto encontrado!'
            : scanStatus === 'not_found'
            ? 'No encontrado'
            : 'Escanear con cámara'}
        </button>

        {/* Input manual — alternativa al scanner */}
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              disabled={disabled || isSearching}
              placeholder="Código o nombre…"
              autoComplete="off"
              className="
                h-13 w-full rounded-xl border-2 border-slate-200 bg-white
                py-3.5 pl-11 pr-10 text-base
                focus:border-blue-500 focus:outline-none
                disabled:bg-slate-50
              "
            />
            {manualValue && (
              <button
                type="button"
                onClick={() => setManualValue('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {manualValue.trim() && (
            <button
              type="button"
              onClick={handleSubmit}
              className="h-13 rounded-xl bg-slate-800 px-4 py-3.5 text-sm font-semibold
                         text-white active:scale-95"
            >
              Buscar
            </button>
          )}
        </div>
      </div>

      {cameraOpen && (
        <CameraScanner onScan={handleCameraScan} onClose={() => setCameraOpen(false)} />
      )}
    </>
  );
}
