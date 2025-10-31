import { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface FieldGroupProps {
  label: ReactNode;
  children: ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

export default function FieldGroup({
  label,
  children,
  error,
  hint,
  required,
  className,
}: FieldGroupProps) {
  const hasError = Boolean(error);

  return (
    <div className={cn('space-y-1', className)}>
      <label
        className={cn(
          'mb-1 block text-sm font-medium text-primary',
          hasError && 'text-destructive'
        )}
      >
        <span className="inline-flex items-center gap-2">
          {label}
          {required && <span className="text-destructive">*</span>}
        </span>
      </label>
      {hint && <p className="mb-1 text-xs text-secondary">{hint}</p>}
      <div
        className={cn(
          hasError &&
            'rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1'
        )}
      >
        {children}
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
