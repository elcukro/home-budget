import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  format: (value: number) => string;
  started: boolean;
  duration?: number;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export default function CountUp({
  value,
  format,
  started,
  duration = 800,
}: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!started || hasAnimated.current) return;
    hasAnimated.current = true;

    let raf = 0;
    const startTime = performance.now();

    const step = (timestamp: number) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      setDisplay(value * eased);

      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        setDisplay(value);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [started, value, duration]);

  return <>{format(started ? display : 0)}</>;
}
