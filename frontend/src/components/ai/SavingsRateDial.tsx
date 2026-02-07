'use client';

import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';

ChartJS.register(ArcElement, Tooltip);

interface SavingsRateDialProps {
  savingsRate: number;
  target?: number; // default 50% for FIRE
}

const SavingsRateDial: React.FC<SavingsRateDialProps> = ({ savingsRate, target = 50 }) => {
  const percentage = Math.min(100, Math.max(0, savingsRate));
  const remaining = 100 - percentage;

  // Color: green if at/above target, yellow if >50% of target, red otherwise
  const getColor = (rate: number) => {
    if (rate >= target) return '#22c55e';
    if (rate >= target * 0.5) return '#eab308';
    return '#ef4444';
  };

  const color = getColor(savingsRate);

  const data = {
    datasets: [{
      data: [percentage, remaining],
      backgroundColor: [color, 'rgba(0,0,0,0.06)'],
      borderWidth: 0,
      cutout: '78%',
      circumference: 270,
      rotation: 225,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      tooltip: { enabled: false },
    },
  };

  return (
    <div className="relative w-full max-w-[180px] mx-auto">
      <Doughnut data={data} options={options} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-primary">{savingsRate.toFixed(1)}%</span>
        <span className="text-[10px] text-secondary leading-tight text-center">
          / {target}%
        </span>
      </div>
    </div>
  );
};

export default SavingsRateDial;
