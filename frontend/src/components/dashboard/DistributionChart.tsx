'use client';

import { useIntl } from 'react-intl';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, PieController } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

// Move registration outside component to ensure it happens only once
ChartJS.register(ArcElement, Tooltip, Legend, PieController);

interface DistributionItem {
  category: string;
  amount: number;
  percentage: number;
}

interface DistributionChartProps {
  title: string;
  data: DistributionItem[];
  formatCurrency: (amount: number) => string;
  type: 'income' | 'expense';
}

export default function DistributionChart({ title, data, formatCurrency, type }: DistributionChartProps) {
  const intl = useIntl();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [chartKey, setChartKey] = useState(Date.now());

  // Re-render chart when locale changes
  useEffect(() => {
    setChartKey(Date.now());
  }, [intl]);

  // Colors for income and expense charts
  const colorSchemes = {
    income: [
      'rgba(34, 197, 94, 0.8)',  // green
      'rgba(59, 130, 246, 0.8)', // blue
      'rgba(168, 85, 247, 0.8)', // purple
      'rgba(14, 165, 233, 0.8)', // sky
      'rgba(45, 212, 191, 0.8)', // teal
    ],
    expense: [
      'rgba(239, 68, 68, 0.8)',  // red
      'rgba(249, 115, 22, 0.8)', // orange
      'rgba(234, 179, 8, 0.8)',  // yellow
      'rgba(217, 70, 239, 0.8)', // fuchsia
      'rgba(236, 72, 153, 0.8)', // pink
    ]
  };

  const chartData = {
    labels: data.map(item => intl.formatMessage({ id: `dashboard.categories.${type}.${item.category}` })),
    datasets: [
      {
        data: data.map(item => item.amount),
        backgroundColor: colorSchemes[type],
        borderColor: isDark ? 'rgba(30, 41, 59, 1)' : 'rgba(255, 255, 255, 1)',
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: isDark ? '#ffffff' : '#000000',
          font: {
            size: 12,
          },
          generateLabels: (chart: any) => {
            const datasets = chart.data.datasets[0];
            return chart.data.labels.map((label: string, index: number) => ({
              text: `${label} (${formatCurrency(datasets.data[index])})`,
              fillStyle: datasets.backgroundColor[index],
              strokeStyle: datasets.borderColor,
              lineWidth: datasets.borderWidth,
              hidden: false,
              index: index,
            }));
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.raw || 0;
            const percentage = (value / data.reduce((acc, curr) => acc + curr.amount, 0) * 100).toFixed(1);
            return `${label}: ${formatCurrency(value)} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-background-primary p-6 rounded-lg shadow h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        {title}
      </h2>
      <div className="relative flex-grow h-[350px]">
        <Pie key={chartKey} data={chartData} options={options} />
      </div>
    </div>
  );
} 