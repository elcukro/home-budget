'use client';

import { useIntl } from 'react-intl';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, PieController, Plugin } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { useEffect, useState } from 'react';

// Move registration outside component to ensure it happens only once
const centerTextPlugin: Plugin<'pie'> = {
  id: 'centerText',
  beforeDraw: (
    chart,
    _args,
    pluginOptions: { text?: string; subtext?: string; textColor?: string; subtextColor?: string },
  ) => {
    const { text, subtext, textColor, subtextColor } = pluginOptions ?? {};
    if (!text) return;
    const { ctx, chartArea } = chart;
    const centerX = (chartArea.left + chartArea.right) / 2;
    const centerY = (chartArea.top + chartArea.bottom) / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 16px var(--font-sans, Inter, system-ui)';
    ctx.fillStyle = textColor || '#1F1C1A';
    ctx.fillText(text, centerX, centerY - (subtext ? 6 : 0));

    if (subtext) {
      ctx.font = '500 12px var(--font-sans, Inter, system-ui)';
      ctx.fillStyle = subtextColor || 'rgba(31, 28, 26, 0.65)';
      ctx.fillText(subtext, centerX, centerY + 14);
    }

    ctx.restore();
  },
};

ChartJS.register(ArcElement, Tooltip, Legend, PieController, centerTextPlugin as any);

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

  const palette = [
    '#22C55E',
    '#F97316',
    '#6366F1',
    '#0EA5E9',
    '#14B8A6',
    '#F59E0B',
    '#EF4444',
    '#A855F7',
    '#D946EF',
  ];

  const categoryColorMap: Record<string, string> = {
    salary: '#22C55E',
    bonus: '#0EA5E9',
    investment: '#14B8A6',
    pension: '#6366F1',
    passive_income: '#14B8A6',
    other_income: '#A855F7',
    groceries: '#F97316',
    food: '#F97316',
    dining_out: '#FB7185',
    housing: '#0EA5E9',
    rent: '#0EA5E9',
    utilities: '#6366F1',
    transport: '#F59E0B',
    transportation: '#F59E0B',
    entertainment: '#D946EF',
    healthcare: '#EF4444',
    insurance: '#14B8A6',
    education: '#A855F7',
    savings: '#22C55E',
    loans: '#EF4444',
    travel: '#38BDF8',
    shopping: '#FB7185',
  };

  const totalAmount = data.reduce((acc, curr) => acc + curr.amount, 0);
  const centerLabel = formatCurrency(totalAmount);

  const chartData = {
    labels: data.map(item => intl.formatMessage({
      id: `dashboard.categories.${type}.${item.category.toLowerCase()}`,
      defaultMessage: item.category
    })),
    datasets: [
      {
        data: data.map(item => item.amount),
        backgroundColor: data.map((item, index) => {
          const key = item.category.toLowerCase();
          return categoryColorMap[key] || palette[index % palette.length];
        }),
        hoverBackgroundColor: data.map((item, index) => {
          const key = item.category.toLowerCase();
          const fallback = palette[index % palette.length];
          return categoryColorMap[key] || fallback;
        }),
        borderColor: '#FFFFFF',
        borderWidth: 3,
        cutout: '68%',
        hoverOffset: 12,
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
            return chart.data.labels.map((label: string, index: number) => {
              const value = datasets.data[index];
              const percentage = totalAmount > 0 ? ((value / totalAmount) * 100).toFixed(1) : '0.0';
              return {
                text: `${label} • ${formatCurrency(value)} • ${percentage}%`,
                fillStyle: datasets.backgroundColor[index],
                strokeStyle: datasets.borderColor,
                lineWidth: datasets.borderWidth,
                hidden: false,
                index,
              };
            });
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.raw || 0;
            const percentage = totalAmount > 0 ? ((value / totalAmount) * 100).toFixed(1) : '0.0';
            return `${label}: ${formatCurrency(value)} (${percentage}%)`;
          },
        },
      },
      centerText: {
        text: centerLabel,
        subtext: intl.formatMessage({ id: `dashboard.distribution.total.${type}` }),
        textColor: '#1F1C1A',
        subtextColor: 'rgba(31, 28, 26, 0.65)',
      },
    },
  };

  return (
    <div className="bg-card border border-default p-6 rounded-2xl shadow-sm h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-4 text-primary">
        {title}
      </h2>
      <div className="relative flex-grow h-[350px]">
        <Pie key={chartKey} data={chartData} options={options} />
      </div>
    </div>
  );
} 
