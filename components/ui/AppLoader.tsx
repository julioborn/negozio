'use client';

import Image from 'next/image';

export function AppLoader() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
      {/* Logo */}
      <div className="mb-8 animate-pulse">
        <Image
          src="/logos/negozio-textogrueso-largo.png"
          alt="Negozio"
          width={180}
          height={45}
          className="object-contain"
          priority
        />
      </div>

      {/* Barra de progreso animada */}
      <div className="h-1 w-48 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-1/2 animate-[slide_1.2s_ease-in-out_infinite] rounded-full bg-primary-700" />
      </div>
    </div>
  );
}
