'use client';

import { cn } from '@/lib/utils';

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  label?: string;
}

export function Toggle({ checked, onChange, disabled = false, size = 'md', label }: Props) {
  const trackClass = size === 'sm'
    ? 'h-5 w-9'
    : 'h-6 w-11';
  const thumbClass = size === 'sm'
    ? 'h-3.5 w-3.5 top-[3px] left-[3px] translate-x-4'
    : 'h-4 w-4 top-1 left-1 translate-x-5';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 rounded-full border-2 border-transparent',
        'transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        trackClass,
        checked ? 'bg-blue-600' : 'bg-slate-200'
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute rounded-full bg-white shadow transition-transform duration-200',
          thumbClass,
          checked ? '' : 'translate-x-0'
        )}
      />
    </button>
  );
}
