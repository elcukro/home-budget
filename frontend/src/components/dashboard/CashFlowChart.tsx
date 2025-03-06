'use client';

import { useIntl } from 'react-intl';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  BarController,
  LineController,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

// Move registration outside component to ensure it happens only once
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineController,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement
);

interface CashFlowData {
  month: string;
  income: number;
  expenses: number;
  loanPayments: number;
  netFlow: number;
  year?: number;
}

interface CashFlowChartProps {
  data: CashFlowData[];
  formatCurrency: (amount: number) => string;
}

export default function CashFlowChart({ data, formatCurrency }: CashFlowChartProps) {
  const intl = useIntl();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [chartKey, setChartKey] = useState(Date.now());

  // Re-render chart when locale changes
  useEffect(() => {
    setChartKey(Date.now());
  }, [intl]);

  // Extract year from data or use current year
  const currentYear = data.length > 0 && data[0].year 
    ? data[0].year 
    : new Date().getFullYear();

  // Format month labels to show only month names without year
  const monthLabels = data.map(item => {
    const monthPart = item.month.split('-')[1];
    return intl.formatMessage({ id: `common.months.${monthPart}` });
  });

  const chartData = {
    labels: monthLabels,
    datasets: [
      {
        type: 'bar' as const,
        label: intl.formatMessage({ id: 'dashboard.cashFlow.income' }),
        data: data.map(item => item.income),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
        stack: 'stack0',
      },
      {
        type: 'bar' as const,
        label: intl.formatMessage({ id: 'dashboard.cashFlow.expenses' }),
        data: data.map(item => -item.expenses),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
        stack: 'stack1',
      },
      {
        type: 'bar' as const,
        label: intl.formatMessage({ id: 'dashboard.cashFlow.loanPayments' }),
        data: data.map(item => -item.loanPayments),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        stack: 'stack1',
      },
      {
        type: 'line' as const,
        label: intl.formatMessage({ id: 'dashboard.cashFlow.netFlow' }),
        data: data.map(item => item.netFlow),
        borderColor: 'rgba(168, 85, 247, 1)',
        backgroundColor: 'rgba(168, 85, 247, 0.5)',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: isDark ? '#ffffff' : '#000000',
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = Math.abs(context.raw);
            return `${label}: ${formatCurrency(value)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: isDark ? '#ffffff' : '#000000',
        },
      },
      y: {
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: isDark ? '#ffffff' : '#000000',
          callback: (value: any) => formatCurrency(Math.abs(value)),
        },
      },
    },
  };

  // Create title with year
  const chartTitle = `${intl.formatMessage({ id: 'dashboard.cashFlow.title' })} ${currentYear}`;

  return (
    <div className="bg-white dark:bg-background-primary p-6 rounded-lg shadow h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        {chartTitle}
      </h2>
      <div className="relative flex-grow h-[500px]">
        <Chart key={chartKey} type="bar" data={chartData} options={options} />
      </div>
    </div>
  );
} 