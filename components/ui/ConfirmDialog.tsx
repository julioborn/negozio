'use client';

import { useState } from 'react';

import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';

import { Modal } from './Modal';
import { Button } from './Button';
import { cn } from '@/lib/utils';

export type ConfirmVariant = 'danger' | 'warning';

export interface ConfirmDialogProps {
  isOpen:        boolean;
  title:         string;
  message:       string;
  confirmLabel?: string;
  cancelLabel?:  string;
  variant?:      ConfirmVariant;
  onConfirm:     () => void | Promise<void>;
  onCancel:      () => void;
}

export function ConfirmDialog({
  isOpen, title, message,
  confirmLabel = 'Confirmar',
  cancelLabel  = 'Cancelar',
  variant      = 'danger',
  onConfirm, onCancel,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="sm" persistent={loading}>
      <div className="flex flex-col items-center gap-4 text-center">
        {/* Ícono */}
        <div className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full',
          variant === 'danger'  ? 'bg-danger-100' : 'bg-amber-100'
        )}>
          {variant === 'danger'
            ? <Trash2 className="h-7 w-7 text-danger-600" />
            : <AlertTriangle className="h-7 w-7 text-amber-600" />
          }
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <p className="mt-1.5 text-sm text-slate-500">{message}</p>
        </div>

        {/* Botones */}
        <div className="flex w-full gap-3">
          <Button
            variant="outline"
            fullWidth
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'secondary'}
            fullWidth
            isLoading={loading}
            leftIcon={loading ? undefined : variant === 'danger' ? <Trash2 className="h-4 w-4" /> : undefined}
            onClick={handleConfirm}
          >
            {loading ? 'Procesando…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
