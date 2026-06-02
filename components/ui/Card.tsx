import { cn } from '@/lib/utils';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

const PADDING: Record<CardPadding, string> = {
  none: '',
  sm:   'p-4',
  md:   'p-5',
  lg:   'p-6',
};

export interface CardProps {
  children:   React.ReactNode;
  className?: string;
  padding?:   CardPadding;
  hoverable?: boolean;
  clickable?: boolean;
  onClick?:   () => void;
}

export function Card({
  children,
  className,
  padding = 'md',
  hoverable,
  clickable,
  onClick,
}: CardProps) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-sm',
        PADDING[padding],
        hoverable && 'transition-shadow hover:shadow-md',
        clickable && 'cursor-pointer transition-all hover:border-primary-300 hover:shadow-md active:scale-[0.99]',
        onClick && 'w-full text-left',
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between border-b border-slate-100 px-5 py-4', className)}>
      {children}
    </div>
  );
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-sm font-semibold text-slate-900', className)}>{children}</h3>
  );
}
