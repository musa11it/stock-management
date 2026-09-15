import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, error, label, hint, id, ...props }, ref) => {
  const inputId = id ?? props.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400',
          'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
          error && 'border-red-400 focus:border-red-500 focus:ring-red-500/20',
          props.disabled && 'cursor-not-allowed bg-slate-50 text-slate-500',
          className,
        )}
        {...props}
      />
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
});
Input.displayName = 'Input';
