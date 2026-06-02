'use client';

import { useEffect } from 'react';

import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: keyof typeof SIZE_CLASSES;
  children: React.ReactNode;
  /** Si true, click en overlay no cierra */
  persistent?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  persistent = false,
}: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !persistent) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, persistent]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={persistent ? undefined : onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full overflow-auto rounded-2xl bg-white shadow-2xl',
          'max-h-[90vh]',
          SIZE_CLASSES[size]
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
