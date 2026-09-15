import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, error, label, id, children, ...props }, ref) => {
  const selectId = id ?? props.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm',
          'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
          error && 'border-red-400 focus:border-red-500 focus:ring-red-500/20',
          props.disabled && 'cursor-not-allowed bg-slate-50 text-slate-500',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
});
Select.displayName = 'Select';
