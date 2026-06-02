import { cn } from '@/lib/utils';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'accent';

const VARIANT: Record<BadgeVariant, string> = {
  success: 'bg-accent-100 text-accent-700 border-accent-200',
  warning: 'bg-amber-100  text-amber-700  border-amber-200',
  danger:  'bg-danger-100 text-danger-700 border-danger-200',
  info:    'bg-primary-100 text-primary-700 border-primary-200',
  default: 'bg-slate-100  text-slate-700  border-slate-200',
  accent:  'bg-accent-600 text-white       border-transparent',
};

export interface BadgeProps {
  variant?:  BadgeVariant;
  children:  React.ReactNode;
  className?: string;
  dot?:      boolean;
}

export function Badge({ variant = 'default', children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        VARIANT[variant],
        className
      )}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full', {
          'bg-accent-500':   variant === 'success',
          'bg-amber-500':    variant === 'warning',
          'bg-danger-500':   variant === 'danger',
          'bg-primary-500':  variant === 'info',
          'bg-slate-500':    variant === 'default',
          'bg-white':        variant === 'accent',
        })} />
      )}
      {children}
    </span>
  );
}
