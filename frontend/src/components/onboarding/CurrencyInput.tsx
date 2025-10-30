'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';

interface CurrencyInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'value' | 'defaultValue' | 'onChange' | 'type'
  > {
  value: number;
  onValueChange: (value: number) => void;
  allowNegative?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const CurrencyInput = React.forwardRef<
  HTMLInputElement,
  CurrencyInputProps
>(
  (
    {
      value,
      onValueChange,
      allowNegative = false,
      className,
      placeholder,
      onFocus,
      onBlur,
      onChange,
      ...props
    },
    ref
  ) => {
    const { settings } = useSettings();
    const locale = settings?.language || 'pl-PL';

    const [displayValue, setDisplayValue] = React.useState('');
    const isFocusedRef = React.useRef(false);

    const numberFormatter = React.useMemo(
      () =>
        new Intl.NumberFormat(locale, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }),
      [locale]
    );

    const separators = React.useMemo(() => {
      const numberFormatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      const parts = numberFormatter.formatToParts(1234567.8);
      return {
        group: parts.find((part) => part.type === 'group')?.value ?? ' ',
        decimal: parts.find((part) => part.type === 'decimal')?.value ?? ',',
      };
    }, [locale]);

    const formatNumberForDisplay = React.useCallback(
      (amount: number) => {
        if (!Number.isFinite(amount)) {
          return '';
        }

        if (amount === 0) {
          return '0';
        }

        return numberFormatter.format(amount);
      },
      [numberFormatter]
    );

    const parseLocalizedNumber = React.useCallback(
      (input: string) => {
        if (!input.trim()) {
          return NaN;
        }

        let normalized = input.trim();

        const groupExp = new RegExp(
          `[\\s${escapeRegExp(separators.group)}]`,
          'g'
        );
        normalized = normalized.replace(groupExp, '');

        const decimalExp = new RegExp(
          escapeRegExp(separators.decimal),
          'g'
        );
        normalized = normalized.replace(decimalExp, '.');

        if (separators.decimal !== '.') {
          normalized = normalized.replace(/,/g, '.');
        }

        const allowed = allowNegative ? /[^0-9.-]/g : /[^0-9.]/g;
        normalized = normalized.replace(allowed, '');

        if (!normalized) {
          return NaN;
        }

        const number = Number.parseFloat(normalized);
        return Number.isFinite(number) ? number : NaN;
      },
      [allowNegative, separators.decimal, separators.group]
    );

    React.useEffect(() => {
      if (isFocusedRef.current) {
        return;
      }

      if (!value) {
        setDisplayValue('');
        return;
      }

      setDisplayValue(formatNumberForDisplay(value));
    }, [value, formatNumberForDisplay]);

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = true;
      if (!displayValue) {
        setDisplayValue('');
      }
      onFocus?.(event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = false;

      if (!value) {
        setDisplayValue('');
      } else {
        setDisplayValue(formatNumberForDisplay(value));
      }

      onBlur?.(event);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      setDisplayValue(raw);

      if (!raw.trim()) {
        onValueChange(0);
        onChange?.(event);
        return;
      }

      const parsed = parseLocalizedNumber(raw);
      if (Number.isNaN(parsed)) {
        onChange?.(event);
        return;
      }

      const rounded = Math.round(parsed * 100) / 100;
      onValueChange(rounded);
      setDisplayValue(formatNumberForDisplay(rounded));
      onChange?.(event);
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        className={cn('font-medium', className)}
        placeholder={
          placeholder ??
          (formatNumberForDisplay(allowNegative ? -12345 : 12345) || '0')
        }
      />
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';
