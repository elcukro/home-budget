'use client';

import { useEffect, useState, useRef } from 'react';

interface StatCardProps {
  value: string;
  label: string;
  source: string;
  delay?: number;
}

function StatCard({ value, label, source, delay = 0 }: StatCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [displayValue, setDisplayValue] = useState('0');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
        }
      },
      { threshold: 0.3 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [delay]);

  useEffect(() => {
    if (!isVisible) return;

    const numericMatch = value.match(/[\d\s]+/);
    if (!numericMatch) {
      setDisplayValue(value);
      return;
    }

    const numericValue = parseInt(numericMatch[0].replace(/\s/g, ''), 10);
    const prefix = value.substring(0, value.indexOf(numericMatch[0]));
    const suffix = value.substring(value.indexOf(numericMatch[0]) + numericMatch[0].length);

    const duration = 1500;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(easeOutQuart * numericValue);

      setDisplayValue(`${prefix}${current.toLocaleString('pl-PL')}${suffix}`);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, value]);

  return (
    <div
      ref={cardRef}
      className={`bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-2xl p-6 text-center transition-all duration-700 hover:shadow-lg hover:shadow-emerald-100/50 hover:border-emerald-200 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <div className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent mb-3">
        {displayValue}
      </div>
      <p className="text-emerald-700/70 text-sm sm:text-base mb-3">{label}</p>
      <p className="text-xs text-emerald-600/50">{source}</p>
    </div>
  );
}

const stats = [
  {
    value: '68%',
    label: 'Polaków nie ma oszczędności na 3 miesiące',
    source: 'NBP 2024',
  },
  {
    value: '42%',
    label: 'gospodarstw domowych ma aktywny kredyt',
    source: 'BIK 2024',
  },
  {
    value: '2 847 PLN',
    label: 'średni miesięczny wydatek na spłaty kredytów',
    source: 'GUS 2024',
  },
  {
    value: '73%',
    label: 'Polaków deklaruje stres finansowy',
    source: 'ING 2024',
  },
];

export default function StatisticsSection() {
  return (
    <section className="py-20 bg-gradient-to-b from-white to-emerald-50/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-emerald-900 text-center mb-4">
          Polska rzeczywistość finansowa
        </h2>
        <p className="text-emerald-700/70 text-center mb-12 max-w-2xl mx-auto">
          Nie jesteś sam. Miliony Polaków borykają się z tymi samymi wyzwaniami.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} delay={index * 150} />
          ))}
        </div>
      </div>
    </section>
  );
}
