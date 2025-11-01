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
  title?: string;
  data: CashFlowData[];
  formatCurrency: (amount: number) => string;
}

export default function CashFlowChart({ title, data, formatCurrency }: CashFlowChartProps) {
  const intl = useIntl();
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
    const [, monthPart] = item.month.split('-');
    return intl.formatMessage({ id: `common.monthsShort.${monthPart}` });
  });

  const cumulativeNet = data.reduce<number[]>((acc, item, index) => {
    const previousValue = index > 0 ? acc[index - 1] : 0;
    acc.push(previousValue + item.netFlow);
    return acc;
  }, []);

  const chartData = {
    labels: monthLabels,
    datasets: [
      {
        type: 'bar' as const,
        label: intl.formatMessage({ id: 'dashboard.cashFlow.income' }),
        data: data.map(item => item.income),
        backgroundColor: '#4BA56ACC',
        borderColor: '#4BA56A',
        borderWidth: 1,
        stack: 'stack0',
      },
      {
        type: 'bar' as const,
        label: intl.formatMessage({ id: 'dashboard.cashFlow.expenses' }),
        data: data.map(item => -item.expenses),
        backgroundColor: '#D65A56CC',
        borderColor: '#D65A56',
        borderWidth: 1,
        stack: 'stack1',
      },
      {
        type: 'bar' as const,
        label: intl.formatMessage({ id: 'dashboard.cashFlow.loanPayments' }),
        data: data.map(item => -item.loanPayments),
        backgroundColor: '#6B9F91CC',
        borderColor: '#6B9F91',
        borderWidth: 1,
        stack: 'stack1',
      },
      {
        type: 'line' as const,
        label: intl.formatMessage({ id: 'dashboard.cashFlow.netFlow' }),
        data: data.map(item => item.netFlow),
        borderColor: '#252529',
        backgroundColor: '#25252933',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        type: 'line' as const,
        label: intl.formatMessage({ id: 'dashboard.cashFlow.cumulative' }),
        data: cumulativeNet,
        borderColor: '#6366F1',
        backgroundColor: '#6366F133',
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5,
        borderDash: [6, 3],
      },
    ],
  };

  const axisColor = 'rgba(31, 28, 26, 0.9)';
  const gridColor = 'rgba(31, 28, 26, 0.16)';

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    animation: {
      duration: 600,
      easing: 'easeOutQuart',
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: axisColor,
          font: {
            size: 12,
          },
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          title: (contexts: any) => {
            if (!contexts?.length) return '';
            const index = contexts[0].dataIndex;
            const dataPoint = data[index];
            if (!dataPoint) return '';
            const [year, month] = dataPoint.month.split('-');
            const monthLabel = intl.formatMessage({ id: `common.months.${month}` });
            return `${monthLabel} ${year || currentYear}`;
          },
          label: (context: any) => {
            const value = Math.abs(context.raw);
            const labelId = context.dataset.label || '';
            return `${labelId}: ${formatCurrency(value)}`;
          },
          afterBody: (contexts: any) => {
            if (!contexts?.length) return '';
            const index = contexts[0].dataIndex;
            const current = data[index];
            const previous = index > 0 ? data[index - 1] : undefined;
            const delta = previous ? current.netFlow - previous.netFlow : 0;
            const deltaFormatted = formatCurrency(Math.abs(delta));
            const direction = delta >= 0
              ? intl.formatMessage({ id: 'dashboard.cashFlow.tooltip.deltaUp' })
              : intl.formatMessage({ id: 'dashboard.cashFlow.tooltip.deltaDown' });
            const netLabel = intl.formatMessage(
              { id: 'dashboard.cashFlow.tooltip.net' },
              { amount: formatCurrency(current.netFlow) },
            );
            const changeLabel = intl.formatMessage(
              { id: 'dashboard.cashFlow.tooltip.change' },
              { direction, amount: deltaFormatted },
            );
            return `${netLabel}\n${changeLabel}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: gridColor,
        },
        ticks: {
          color: axisColor,
        },
      },
      y: {
        grid: {
          color: gridColor,
        },
        ticks: {
          color: axisColor,
          callback: (value: any) => formatCurrency(Math.abs(value)),
        },
      },
    },
  };

  const heading = title || intl.formatMessage({ id: 'dashboard.cashFlow.title' });

  return (
    <div className="bg-card border border-default p-6 rounded-lg shadow-sm h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">
          {heading}
        </h2>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-secondary">
          {currentYear}
        </span>
      </div>
      <div className="relative flex-grow h-[500px]">
        <Chart key={chartKey} type="bar" data={chartData} options={options} />
      </div>
    </div>
  );
} 
