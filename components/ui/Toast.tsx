'use client';

import { useEffect } from 'react';

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

import { useToastStore, type ToastItem, type ToastType } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

const CONFIG: Record<ToastType, { icon: React.ElementType; classes: string }> = {
  success: { icon: CheckCircle2, classes: 'border-accent-200  bg-accent-50  text-accent-800' },
  error:   { icon: XCircle,      classes: 'border-danger-200  bg-danger-50  text-danger-800' },
  warning: { icon: AlertTriangle, classes: 'border-amber-200  bg-amber-50   text-amber-800' },
  info:    { icon: Info,          classes: 'border-primary-200 bg-primary-50 text-primary-800' },
};

function ToastCard({ toast }: { toast: ToastItem }) {
  const remove = useToastStore((s) => s.remove);
  const { icon: Icon, classes } = CONFIG[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => remove(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, remove]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg',
        'animate-in slide-in-from-right-4 duration-200',
        classes
      )}
      style={{ minWidth: 280, maxWidth: 400 }}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => remove(toast.id)}
        className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}
