import React, { useState } from 'react';

interface EditableCellProps {
  value: string | number;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  isEditing: boolean;
  validation?: (value: string) => string | null;
  type?: string;
  prefix?: string;
  options?: { value: string; label: React.ReactNode }[];
  onSave?: () => void;
  onCancel?: () => void;
  formatter?: (value: any) => React.ReactNode;
  field?: string;
  focusField?: string;
  min?: number;
  step?: number;
}

export const EditableCell: React.FC<EditableCellProps> = ({
  value,
  onChange,
  onBlur,
  onKeyDown,
  isEditing,
  validation,
  type = 'text',
  prefix,
  options,
  onSave,
  onCancel,
  formatter,
  field,
  focusField,
  min,
  step
}) => {
  const [error, setError] = useState<string | null>(null);

  const handleChange = (newValue: string) => {
    onChange(newValue);
    if (validation) {
      const validationError = validation(newValue);
      setError(validationError);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSave) {
      onSave();
    } else if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  if (!isEditing) {
    return (
      <div className="p-1">
        {prefix && <span className="text-subtle">{prefix}</span>}
        {formatter ? formatter(value) : value}
      </div>
    );
  }

  if (type === 'select' && options) {
    return (
      <select
        value={String(value)}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded border border-border bg-card py-1 px-2 text-sm text-primary"
        autoFocus={isEditing && field === focusField}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-subtle">
          {prefix}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        min={min}
        step={step}
        className={`w-full rounded border bg-card py-1 px-2 text-sm ${
          error ? 'border-destructive' : 'border-border'
        } ${prefix ? 'pl-6' : ''}`}
        autoFocus={isEditing && field === focusField}
      />
      {error && <span className="absolute -bottom-5 left-0 text-xs text-destructive">{error}</span>}
    </div>
  );
}; 
