'use client';

import dynamic from 'next/dynamic';
import { useCallback, useRef, useState } from 'react';

import { Camera, Loader2, Search, X } from 'lucide-react';

// CameraScanner usa html5-qrcode (browser-only), solo se carga del lado del cliente
const CameraScanner = dynamic(
  () => import('./CameraScanner').then((m) => m.CameraScanner),
  { ssr: false }
);

interface Props {
  onDetect: (barcode: string) => void;
  isSearching?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function BarcodeInput({
  onDetect,
  isSearching = false,
  disabled = false,
  placeholder = 'Código de barras o nombre…',
}: Props) {
  const [value, setValue] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && value.trim()) {
        e.preventDefault();
        onDetect(value.trim());
      }
    },
    [value, onDetect]
  );

  const handleCameraScan = useCallback(
    (code: string) => {
      setCameraOpen(false);
      setValue(code);
      onDetect(code);
    },
    [onDetect]
  );

  const handleClear = () => {
    setValue('');
    inputRef.current?.focus();
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Input del scanner / teclado */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isSearching}
            placeholder={placeholder}
            autoComplete="off"
            className="
              block w-full rounded-lg border border-slate-300 bg-white
              py-2.5 pl-10 pr-10 text-sm text-slate-900
              placeholder:text-slate-400
              focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:cursor-not-allowed disabled:bg-slate-50
            "
          />

          {/* Spinner o botón de limpiar */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            ) : value ? (
              <button
                type="button"
                onClick={handleClear}
                className="text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Botón de cámara */}
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          disabled={disabled || isSearching}
          title="Escanear con cámara"
          className="
            flex h-10 w-10 shrink-0 items-center justify-center
            rounded-lg border border-slate-300 bg-white text-slate-600
            transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600
            disabled:cursor-not-allowed disabled:opacity-50
          "
        >
          <Camera className="h-4 w-4" />
        </button>
      </div>

      {/* Hint del scanner USB */}
      <p className="mt-1 text-xs text-slate-400">
        Escribí o apuntá el scanner — presioná Enter para buscar
      </p>

      {/* Modal de cámara */}
      {cameraOpen && (
        <CameraScanner
          onScan={handleCameraScan}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </>
  );
}
