import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:      string;
  error?:      string;
  hint?:       string;
  required?:   boolean;
  leftIcon?:   React.ReactNode;
  rightIcon?:  React.ReactNode;
  onRightIconClick?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, required, leftIcon, rightIcon, onRightIconClick, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
            {label}
            {required && <span className="ml-0.5 text-danger-500">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 text-slate-400">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'block w-full rounded-lg border py-2.5 text-sm text-slate-900',
              'placeholder:text-slate-400 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-offset-1',
              'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
              error
                ? 'border-danger-400 focus:ring-danger-400'
                : 'border-slate-300 focus:border-primary-500 focus:ring-primary-500',
              leftIcon  ? 'pl-10' : 'pl-3',
              rightIcon ? 'pr-10' : 'pr-3',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span
              className={cn(
                'absolute right-3 text-slate-400',
                onRightIconClick && 'cursor-pointer hover:text-slate-600'
              )}
              onClick={onRightIconClick}
            >
              {rightIcon}
            </span>
          )}
        </div>

        {error && <p className="text-xs text-danger-600">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
