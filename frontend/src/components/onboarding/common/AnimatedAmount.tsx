import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

export type AmountTone = 'low' | 'medium' | 'high';

const toneClassMap: Record<AmountTone, string> = {
  low: 'text-primary',
  medium: 'text-success',
  high: 'text-destructive',
};

export function useAnimatedNumber(value: number, duration = 260) {
  const [display, setDisplay] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const initial = previousValue.current;
    const delta = value - initial;

    if (Math.abs(delta) < 0.01) {
      setDisplay(value);
      previousValue.current = value;
      return;
    }

    const step = (timestamp: number) => {
      const progress = Math.min((timestamp - start) / duration, 1);
      setDisplay(initial + delta * progress);
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        previousValue.current = value;
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  useEffect(() => {
    previousValue.current = value;
    setDisplay(value);
  }, [value]);

  return display;
}

interface AnimatedAmountProps {
  value: number;
  formatMoney: (value: number) => string;
  tone?: AmountTone;
  className?: string;
}

export function AnimatedAmount({
  value,
  formatMoney,
  tone = 'low',
  className,
}: AnimatedAmountProps) {
  const animatedValue = useAnimatedNumber(value);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    setBump(true);
    const timeout = window.setTimeout(() => setBump(false), 220);
    return () => window.clearTimeout(timeout);
  }, [value]);

  return (
    <span
      className={cn(
        'inline-flex min-w-[4.5rem] justify-end tabular-nums transition-transform duration-200',
        toneClassMap[tone],
        bump && 'scale-[1.04]',
        className
      )}
    >
      {formatMoney(animatedValue)}
    </span>
  );
}
