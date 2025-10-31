import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  Tooltip as ChartTooltip,
} from 'chart.js';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, BarElement, ChartTooltip);

const SALARY_DISTRIBUTION_POINTS: Array<{ income: number; percentile: number }> = [
  { income: 0, percentile: 2 },
  { income: 2000, percentile: 12 },
  { income: 3000, percentile: 27 },
  { income: 4000, percentile: 41 },
  { income: 5000, percentile: 55 },
  { income: 6000, percentile: 66 },
  { income: 7000, percentile: 75 },
  { income: 9000, percentile: 85 },
  { income: 11000, percentile: 91 },
  { income: 13000, percentile: 95 },
  { income: 16000, percentile: 97 },
  { income: 20000, percentile: 99 },
  { income: 25000, percentile: 99.5 },
  { income: 30000, percentile: 99.8 },
];

const MIN_SALARY_IN_CHART = SALARY_DISTRIBUTION_POINTS[0].income;
const MAX_SALARY_IN_CHART =
  SALARY_DISTRIBUTION_POINTS[SALARY_DISTRIBUTION_POINTS.length - 1].income;

interface SalaryDistributionChartProps {
  salary: number;
  formatMoney: (value: number) => string;
}

export default function SalaryDistributionChart({
  salary,
  formatMoney,
}: SalaryDistributionChartProps) {
  const intl = useIntl();

  const { chartData, chartOptions, summaryText } = useMemo(() => {
    const labels = SALARY_DISTRIBUTION_POINTS.map((point) =>
      point.income >= 1000 ? `${Math.round(point.income / 1000)}k` : `${point.income}`
    );

    const clampedSalary = salary > 0
      ? Math.min(Math.max(salary, MIN_SALARY_IN_CHART), MAX_SALARY_IN_CHART)
      : 0;

    let lower = SALARY_DISTRIBUTION_POINTS[0];
    let upper = SALARY_DISTRIBUTION_POINTS[SALARY_DISTRIBUTION_POINTS.length - 1];
    let rangeIndex = SALARY_DISTRIBUTION_POINTS.length - 1;

    if (clampedSalary > 0) {
      for (let i = 0; i < SALARY_DISTRIBUTION_POINTS.length - 1; i += 1) {
        const current = SALARY_DISTRIBUTION_POINTS[i];
        const next = SALARY_DISTRIBUTION_POINTS[i + 1];
        if (clampedSalary >= current.income && clampedSalary <= next.income) {
          lower = current;
          upper = next;
          rangeIndex = Math.min(i + 1, SALARY_DISTRIBUTION_POINTS.length - 1);
          break;
        }
      }
    }

    const baseColors = SALARY_DISTRIBUTION_POINTS.map(() => 'rgba(37, 99, 235, 0.45)');
    const borderColors = SALARY_DISTRIBUTION_POINTS.map(() => 'rgba(37, 99, 235, 0.6)');

    let highlightPercentile = lower.percentile;
    if (clampedSalary > 0) {
      const range = upper.income - lower.income || 1;
      const ratio = (clampedSalary - lower.income) / range;
      highlightPercentile =
        lower.percentile + ratio * (upper.percentile - lower.percentile);
      baseColors[rangeIndex] = 'rgba(22, 163, 74, 0.9)';
      borderColors[rangeIndex] = 'rgba(22, 163, 74, 1)';
    }

    const barDataset = {
      type: 'bar' as const,
      label: intl.formatMessage({
        id: 'onboarding.income.distribution.datasetLabel',
      }),
      data: SALARY_DISTRIBUTION_POINTS.map((point) => point.percentile),
      backgroundColor: baseColors,
      borderColor: borderColors,
      borderWidth: 1,
      borderRadius: 6,
      maxBarThickness: 22,
    };

    const chartOptions: ChartOptions<'bar'> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: TooltipItem<'bar'>) =>
              intl.formatMessage(
                { id: 'onboarding.income.distribution.tooltip' },
                { value: context.parsed.y?.toFixed(0) ?? 0 }
              ),
          },
        },
      },
      interaction: { intersect: false, mode: 'nearest' },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 6, color: '#6b7280', font: { size: 10 } },
        },
        y: {
          grid: { display: false },
          ticks: {
            callback: (value: string | number) =>
              typeof value === 'number' ? `${value}%` : value,
            color: '#6b7280',
            font: { size: 10 },
          },
          min: 0,
          max: 100,
        },
      },
    };

    const chartData: ChartData<'bar'> = {
      labels,
      datasets: [barDataset],
    };

    const percentileRounded = Math.round(highlightPercentile);
    const aboveShare = Math.max(0, 100 - percentileRounded);
    const summaryText =
      salary > 0
        ? intl.formatMessage(
            { id: 'onboarding.income.distribution.summaryWithSalary' },
            {
              amount: formatMoney(salary),
              share: aboveShare,
            }
          )
        : intl.formatMessage({
            id: 'onboarding.income.distribution.summaryWithoutSalary',
          });

    return { chartData, chartOptions, summaryText };
  }, [salary, formatMoney, intl]);

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-muted/50 bg-card px-2 py-2">
        <div style={{ height: 140 }}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>
      <p className="text-xs text-secondary">{summaryText}</p>
    </div>
  );
}
