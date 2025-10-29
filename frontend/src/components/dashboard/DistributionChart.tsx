'use client';

import { useIntl } from 'react-intl';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, PieController } from 'chart.js';
import { Pie } from 'react-chartjs-2';
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
  const [chartKey, setChartKey] = useState(Date.now());

  // Re-render chart when locale changes
  useEffect(() => {
    setChartKey(Date.now());
  }, [intl]);

  // Colors for income and expense charts
  const colorSchemes = {
    income: [
      '#9FD3C1',
      '#CDBAD6',
      '#E8C1BC',
      '#E2D6C6',
      '#6B9F91',
    ],
    expense: [
      '#D65A56',
      '#E67C3F',
      '#6B9F91',
      '#CDBAD6',
      '#E8C1BC',
    ]
  };

  const chartData = {
    labels: data.map(item => intl.formatMessage({ id: `dashboard.categories.${type}.${item.category}` })),
    datasets: [
      {
        data: data.map(item => item.amount),
        backgroundColor: colorSchemes[type],
        borderColor: '#F5EFE8',
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
          color: '#1F1C1A',
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
    <div className="bg-card border border-default p-6 rounded-lg shadow-sm h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-4 text-primary">
        {title}
      </h2>
      <div className="relative flex-grow h-[350px]">
        <Pie key={chartKey} data={chartData} options={options} />
      </div>
    </div>
  );
} 
