'use client';

import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from 'chart.js';
import { CategoryChartData } from '@/types/insights';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const DEFAULT_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#64748b',
];

interface CategoryChartProps {
  chartData: CategoryChartData;
  height?: number;
}

const CategoryChart: React.FC<CategoryChartProps> = ({ chartData, height = 200 }) => {
  const labels = chartData.data.map(d => d.label);
  const values = chartData.data.map(d => d.value);
  const colors = chartData.data.map((d, i) => d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]);

  if (chartData.type === 'donut') {
    const data = {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.8)',
      }],
    };

    return (
      <div style={{ maxHeight: height }} className="mx-auto max-w-[200px]">
        <Doughnut
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: true,
            cutout: '60%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: { boxWidth: 10, font: { size: 10 } },
              },
            },
          }}
        />
      </div>
    );
  }

  if (chartData.type === 'bar') {
    const data = {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderRadius: 4,
        barThickness: 24,
      }],
    };

    return (
      <div style={{ maxHeight: height }}>
        <Bar
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
              legend: { display: false },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { font: { size: 10 } },
              },
              y: {
                grid: { display: false },
                ticks: { font: { size: 10 } },
              },
            },
          }}
        />
      </div>
    );
  }

  // Progress type — simple horizontal bar
  if (chartData.type === 'progress' || chartData.type === 'timeline') {
    const total = values.reduce((a, b) => a + b, 0);
    return (
      <div className="space-y-2">
        {chartData.data.map((d, i) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <div key={i}>
              <div className="flex justify-between text-xs text-secondary mb-0.5">
                <span>{d.label}</span>
                <span>{d.value.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
};

export default CategoryChart;
