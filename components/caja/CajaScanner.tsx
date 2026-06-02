'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Camera, ScanLine, X } from 'lucide-react';

import { cn } from '@/lib/utils';

const CameraScanner = dynamic(
  () => import('@/components/products/CameraScanner').then((m) => m.CameraScanner),
  { ssr: false }
);

type ScanStatus = 'idle' | 'searching' | 'found' | 'not_found';

interface Props {
  onScan: (barcode: string) => void;
  isSearching?: boolean;
  scanStatus?: ScanStatus;
  isDark?: boolean;
  disabled?: boolean;
}

export function CajaScanner({ onScan, isSearching = false, scanStatus = 'idle', disabled = false, isDark = true }: Props) {
  const [value, setValue] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus al montar y cuando se termina de escanear
  useEffect(() => {
    if (!cameraOpen) inputRef.current?.focus();
  }, [cameraOpen, scanStatus]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && value.trim()) {
        e.preventDefault();
        onScan(value.trim());
        setValue('');
      }
    },
    [value, onScan]
  );

  const handleCameraScan = useCallback(
    (code: string) => {
      setCameraOpen(false);
      onScan(code);
    },
    [onScan]
  );

  // F2 = forzar foco al scanner desde cualquier parte de la página
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border-2 p-2 transition-all duration-200',
          scanStatus === 'found'
            ? 'border-green-500 bg-green-950/40'
            : scanStatus === 'not_found'
            ? 'border-red-500 bg-red-950/40'
            : isDark
            ? 'border-gray-700 bg-gray-900 focus-within:border-blue-500'
            : 'border-slate-300 bg-white focus-within:border-primary-500'
        )}
      >
        {/* Ícono de estado */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center">
          {isSearching ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          ) : (
            <ScanLine
              className={cn(
                'h-5 w-5 transition-colors',
                scanStatus === 'found' ? 'text-green-400' :
                scanStatus === 'not_found' ? 'text-red-400' :
                'text-gray-500'
              )}
            />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSearching}
          placeholder="Escaneá o escribí el código…"
          autoComplete="off"
          className="
            flex-1 bg-transparent text-lg font-medium text-white
            placeholder:text-gray-600
            focus:outline-none
            disabled:cursor-not-allowed
          "
        />

        {value && (
          <button
            type="button"
            onClick={() => { setValue(''); inputRef.current?.focus(); }}
            className="p-1 text-gray-600 hover:text-gray-400"
            tabIndex={-1}
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          disabled={disabled}
          title="Escanear con cámara (F2 = foco)"
          className="
            flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
            text-gray-500 hover:bg-gray-800 hover:text-gray-300
            disabled:cursor-not-allowed disabled:opacity-40
          "
        >
          <Camera className="h-5 w-5" />
        </button>
      </div>

      {cameraOpen && (
        <CameraScanner onScan={handleCameraScan} onClose={() => setCameraOpen(false)} />
      )}
    </>
  );
}
