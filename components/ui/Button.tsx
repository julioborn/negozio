import { forwardRef } from 'react';

import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'accent';
export type ButtonSize    = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary:   'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-sm',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-400',
  danger:    'bg-danger-600 text-white hover:bg-danger-700 focus:ring-danger-500 shadow-sm',
  ghost:     'bg-transparent text-slate-700 hover:bg-slate-100 focus:ring-slate-400',
  outline:   'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-400',
  accent:    'bg-accent-600 text-white hover:bg-accent-700 focus:ring-accent-500 shadow-sm',
};

const SIZE: Record<ButtonSize, string> = {
  sm:  'h-8 px-3 text-xs gap-1.5',
  md:  'h-10 px-4 text-sm gap-2',
  lg:  'h-12 px-6 text-base gap-2.5',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  isLoading?: boolean;
  leftIcon?:  React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className, variant = 'primary', size = 'md',
      isLoading, leftIcon, rightIcon, fullWidth,
      disabled, children, ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-lg',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'active:scale-[0.98]',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : leftIcon ? (
        <span className="shrink-0">{leftIcon}</span>
      ) : null}
      {children}
      {!isLoading && rightIcon && (
        <span className="shrink-0">{rightIcon}</span>
      )}
    </button>
  )
);

Button.displayName = 'Button';
