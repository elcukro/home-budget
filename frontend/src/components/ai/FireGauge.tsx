'use client';

import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';

ChartJS.register(ArcElement, Tooltip);

interface FireGaugeProps {
  currentSavings: number;
  fireNumber: number;
  formatCurrency: (value: number) => string;
}

const FireGauge: React.FC<FireGaugeProps> = ({ currentSavings, fireNumber, formatCurrency: _formatCurrency }) => {
  const percentage = fireNumber > 0 ? Math.min(100, (currentSavings / fireNumber) * 100) : 0;
  const remaining = Math.max(0, 100 - percentage);

  // Color gradient: red (<25%) → orange (<50%) → yellow (<75%) → green (>=75%)
  const getColor = (pct: number) => {
    if (pct >= 75) return '#22c55e';
    if (pct >= 50) return '#eab308';
    if (pct >= 25) return '#f97316';
    return '#ef4444';
  };

  const color = getColor(percentage);

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
        <span className="text-2xl font-bold text-primary">{percentage.toFixed(0)}%</span>
        <span className="text-[10px] text-secondary leading-tight text-center px-2">
          FIRE
        </span>
      </div>
    </div>
  );
};

export default FireGauge;
