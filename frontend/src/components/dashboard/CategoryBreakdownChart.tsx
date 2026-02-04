'use client';

import { useIntl } from 'react-intl';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, PieController, Plugin } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { useEffect, useState } from 'react';
import { PieChart } from 'lucide-react';

const centerTextPlugin: Plugin<'pie'> = {
  id: 'categoryBreakdownCenterText',
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

interface CategoryItem {
  category: string;
  amount: number;
  percentage: number;
}

interface CategoryBreakdownChartProps {
  data: CategoryItem[];
  formatCurrency: (amount: number) => string;
}

const categoryColorMap: Record<string, string> = {
  housing: '#0EA5E9',
  rent: '#0EA5E9',
  transportation: '#F59E0B',
  transport: '#F59E0B',
  food: '#F97316',
  groceries: '#F97316',
  dining_out: '#FB7185',
  utilities: '#6366F1',
  insurance: '#14B8A6',
  healthcare: '#EF4444',
  entertainment: '#D946EF',
  education: '#A855F7',
  shopping: '#FB7185',
  travel: '#38BDF8',
  savings: '#22C55E',
  loans: '#EF4444',
  other: '#9CA3AF',
};

const fallbackPalette = [
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

export default function CategoryBreakdownChart({ data, formatCurrency }: CategoryBreakdownChartProps) {
  const intl = useIntl();
  const [chartKey, setChartKey] = useState(Date.now());
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setChartKey(Date.now());
  }, [intl]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const totalAmount = data.reduce((acc, curr) => acc + curr.amount, 0);

  if (!data || data.length === 0 || totalAmount === 0) {
    return (
      <div className="bg-card border border-default p-6 rounded-2xl shadow-sm h-full flex flex-col">
        <h2 className="text-lg font-semibold mb-4 text-primary">
          {intl.formatMessage({ id: 'dashboard.categoryBreakdown.title' })}
        </h2>
        <div className="flex-grow flex flex-col items-center justify-center py-12 text-secondary">
          <PieChart className="h-12 w-12 opacity-30 mb-4" />
          <p className="text-center text-sm">
            {intl.formatMessage({ id: 'dashboard.categoryBreakdown.emptyState' })}
          </p>
        </div>
      </div>
    );
  }

  const centerLabel = formatCurrency(totalAmount);

  const getLocalizedCategory = (category: string): string => {
    const key = category.toLowerCase();
    return intl.formatMessage({
      id: `expenses.categories.${key}`,
      defaultMessage: category.charAt(0).toUpperCase() + category.slice(1),
    });
  };

  const chartData = {
    labels: data.map(item => getLocalizedCategory(item.category)),
    datasets: [
      {
        data: data.map(item => item.amount),
        backgroundColor: data.map((item, index) => {
          const key = item.category.toLowerCase();
          return categoryColorMap[key] || fallbackPalette[index % fallbackPalette.length];
        }),
        hoverBackgroundColor: data.map((item, index) => {
          const key = item.category.toLowerCase();
          return categoryColorMap[key] || fallbackPalette[index % fallbackPalette.length];
        }),
        borderColor: '#FFFFFF',
        borderWidth: 3,
        cutout: '68%',
        hoverOffset: 12,
      },
    ],
  };

  const legendPosition: 'bottom' | 'right' = isMobile ? 'bottom' : 'right';

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: legendPosition,
        labels: {
          color: '#1F1C1A',
          font: {
            size: 12,
          },
          padding: isMobile ? 12 : 16,
          boxWidth: 12,
          boxHeight: 12,
          generateLabels: (chart: any) => {
            const datasets = chart.data.datasets[0];
            return chart.data.labels.map((label: string, index: number) => {
              const value = datasets.data[index];
              const percentage = totalAmount > 0 ? ((value / totalAmount) * 100).toFixed(1) : '0.0';
              const displayLabel = isMobile
                ? `${label} (${percentage}%)`
                : `${label} • ${formatCurrency(value)} • ${percentage}%`;
              return {
                text: displayLabel,
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
      categoryBreakdownCenterText: {
        text: centerLabel,
        subtext: intl.formatMessage({ id: 'dashboard.categoryBreakdown.totalExpenses' }),
        textColor: '#1F1C1A',
        subtextColor: 'rgba(31, 28, 26, 0.65)',
      },
    },
  };

  return (
    <div className="bg-card border border-default p-6 rounded-2xl shadow-sm h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-4 text-primary">
        {intl.formatMessage({ id: 'dashboard.categoryBreakdown.title' })}
      </h2>
      <div className="relative flex-grow h-[350px]">
        <Pie key={chartKey} data={chartData} options={options} />
      </div>
    </div>
  );
}
