'use client';

import { useEffect, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { inlinePriceSchema, type InlinePriceFormData } from '@/lib/validations/product';
import { formatCurrency } from '@/lib/utils';

interface Props {
  epId: string;
  currentPrice: number;
  canEdit: boolean;
  onSave: (epId: string, price: number) => Promise<void>;
}

export function InlinePriceEdit({ epId, currentPrice, canEdit, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InlinePriceFormData>({
    resolver: zodResolver(inlinePriceSchema),
    defaultValues: { price: currentPrice },
  });

  // Focus automático al entrar en modo edición
  useEffect(() => {
    if (editing) {
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [editing]);

  function handleCancel() {
    reset({ price: currentPrice });
    setEditing(false);
  }

  async function onSubmit(data: InlinePriceFormData) {
    if (data.price === currentPrice) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(epId, data.price);
      setEditing(false);
    } catch {
      // error shown via toast en el padre
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <span className="group flex items-center gap-1">
        <span className="font-medium text-slate-900">{formatCurrency(currentPrice)}</span>
        {canEdit && (
          <button
            onClick={() => setEditing(true)}
            title="Editar precio"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    );
  }

  const { ref: rhfRef, ...restRegister } = register('price', { valueAsNumber: true });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col">
        <input
          {...restRegister}
          ref={(el) => {
            rhfRef(el);
            inputRef.current = el;
          }}
          type="number"
          step="0.01"
          min="0.01"
          disabled={saving}
          className={`
            w-28 rounded border px-2 py-1 text-right text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500
            ${errors.price ? 'border-red-400' : 'border-blue-400'}
          `}
          onKeyDown={(e) => e.key === 'Escape' && handleCancel()}
        />
        {errors.price && (
          <span className="text-xs text-red-500">{errors.price.message}</span>
        )}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded p-1 text-green-600 hover:bg-green-50 disabled:opacity-50"
        title="Guardar"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
      </button>

      <button
        type="button"
        onClick={handleCancel}
        disabled={saving}
        className="rounded p-1 text-slate-400 hover:bg-slate-100"
        title="Cancelar"
      >
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}
