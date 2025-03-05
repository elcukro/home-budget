'use client';

import { useEffect, useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { useSettings } from '@/contexts/SettingsContext';
import ProtectedPage from '@/components/ProtectedPage';
import { useSession } from 'next-auth/react';
import PeriodSelector from '@/components/PeriodSelector';
import { formatCurrency } from '@/utils/formatters';
import ErrorBoundary from '@/components/ErrorBoundary';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowTrendUp, faArrowTrendDown, faLandmark } from '@fortawesome/free-solid-svg-icons';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { FormattedMessage } from 'react-intl';
import { useTheme } from 'next-themes';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface MonthlyData {
  incomes: Array<{
    id: number;
    title: string;
    amount: number;
    category: string;
    date: string;
  }>;
  expenses: Array<{
    id: number;
    title: string;
    amount: number;
    category: string;
    date: string;
  }>;
  loanPayments: Array<{
    id: number;
    loan_type: string;
    description: string;
    principal_amount: number;
    remaining_balance: number;
    interest_rate: number;
    monthly_payment: number;
    start_date: string;
    term_months: number;
  }>;
  totals: {
    income: number;
    expenses: number;
    loanPayments: number;
    balance: number;
  };
}

interface YearlyBudget {
  [key: string]: MonthlyData;
}

interface PeriodSelection {
  startDate: Date;
  endDate: Date;
}

const MonthCard = ({ monthName, data }: { monthName: string; data: MonthlyData }) => {
  const { settings, isLoading: isSettingsLoading } = useSettings();
  const intl = useIntl();

  if (isSettingsLoading) {
    return <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-24 rounded-lg"></div>;
  }

  // Extract month and year from monthName (e.g., "December 2024")
  const [month, year] = monthName.split(' ');
  const monthNumber = new Date(Date.parse(`${month} 1, 2000`)).getMonth() + 1;
  
  // Get localized month name
  const localizedMonth = intl.formatMessage({ id: `reports.months.${monthNumber}` });
  const displayName = `${localizedMonth} ${year}`;

  const currency = settings?.currency || 'USD';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 h-full border border-gray-200 dark:border-gray-700 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-90">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100">{displayName}</h3>
        <div className={`text-xs font-semibold ${data.totals.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {formatCurrency(data.totals.balance, currency)}
        </div>
      </div>

      <div className="space-y-1 text-xs">
        {/* Income */}
        <div className="flex justify-between items-center text-green-600 dark:text-green-400">
          <FontAwesomeIcon icon={faArrowTrendUp} className="w-3 h-3" title={intl.formatMessage({ id: 'reports.income' })} />
          <span className="text-[11px]">{formatCurrency(data.totals.income, currency)}</span>
        </div>

        {/* Expenses */}
        <div className="flex justify-between items-center text-red-600 dark:text-red-400">
          <FontAwesomeIcon icon={faArrowTrendDown} className="w-3 h-3" title={intl.formatMessage({ id: 'reports.expenses' })} />
          <span className="text-[11px]">{formatCurrency(data.totals.expenses, currency)}</span>
        </div>

        {/* Loan Payments */}
        {data.totals.loanPayments > 0 && (
          <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
            <FontAwesomeIcon icon={faLandmark} className="w-3 h-3" title={intl.formatMessage({ id: 'reports.loanPayments' })} />
            <span className="text-[11px]">{formatCurrency(data.totals.loanPayments, currency)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const FinancialChart = ({ data, currency }: { data: YearlyBudget; currency: string }) => {
  const intl = useIntl();
  const { settings } = useSettings();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  
  const chartData = useMemo(() => {
    const monthEntries = Object.entries(data);
    
    // Transform month names to localized versions
    const localizedLabels = monthEntries.map(([monthName]) => {
      const [month, year] = monthName.split(' ');
      const monthNumber = new Date(Date.parse(`${month} 1, 2000`)).getMonth() + 1;
      const localizedMonth = intl.formatMessage({ id: `reports.months.${monthNumber}` });
      return `${localizedMonth} ${year}`;
    });

    // Get the data values
    const totalIncome = monthEntries.map(([_, data]) => data.totals.income);
    const totalExpenses = monthEntries.map(([_, data]) => data.totals.expenses);
    const totalLoans = monthEntries.map(([_, data]) => data.totals.loanPayments);
    const availableCash = monthEntries.map(([_, data]) => 
      data.totals.income - (data.totals.expenses + data.totals.loanPayments)
    );

    return {
      labels: localizedLabels,
      datasets: [
        {
          label: intl.formatMessage({ id: 'reports.income' }),
          data: totalIncome,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
          tension: 0.3,
        },
        {
          label: intl.formatMessage({ id: 'reports.expenses' }),
          data: totalExpenses,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
          tension: 0.3,
        },
        {
          label: intl.formatMessage({ id: 'reports.loanPayments' }),
          data: totalLoans,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          tension: 0.3,
        },
        {
          label: intl.formatMessage({ id: 'reports.availableCash' }),
          data: availableCash,
          borderColor: 'rgb(168, 85, 247)',
          backgroundColor: 'rgba(168, 85, 247, 0.5)',
          tension: 0.3,
        },
      ],
    };
  }, [data, intl]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: isDarkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.9)',
          font: {
            size: 12,
            weight: isDarkMode ? ('bold' as const) : ('normal' as const)
          }
        },
      },
      tooltip: {
        titleColor: isDarkMode ? '#ffffff' : '#000000',
        bodyColor: isDarkMode ? '#ffffff' : '#000000',
        backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.95)',
        titleFont: {
          weight: 'bold' as const
        },
        bodyFont: {
          weight: 'normal' as const
        },
        padding: 12,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += formatCurrency(context.parsed.y, currency);
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        ticks: {
          color: isDarkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.9)',
          font: {
            size: 11,
            weight: isDarkMode ? ('bold' as const) : ('normal' as const)
          },
          callback: function(value: any) {
            return formatCurrency(value, currency);
          }
        },
        grid: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
        }
      },
      x: {
        ticks: {
          color: isDarkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.9)',
          font: {
            size: 11,
            weight: isDarkMode ? ('bold' as const) : ('normal' as const)
          }
        },
        grid: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
        }
      }
    }
  };

  return (
    <div className="w-full h-[400px] bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-8 border border-gray-200 dark:border-gray-700 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-90">
      <Line options={options} data={chartData} />
    </div>
  );
};

const BudgetReport = () => {
  const [yearlyData, setYearlyData] = useState<YearlyBudget | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = useSession();
  const { settings } = useSettings();
  const intl = useIntl();
  
  // Set default period to current year
  const [period, setPeriod] = useState<PeriodSelection>(() => {
    const currentYear = new Date().getFullYear();
    return {
      startDate: new Date(currentYear, 0, 1), // Start of current year
      endDate: new Date(currentYear, 11, 31), // End of current year
    };
  });

  const fetchYearlyBudget = async () => {
    if (!session?.user?.email) return;

    setIsLoading(true);
    setError(null);

    try {
      const startMonth = period.startDate.toISOString().slice(0, 7); // YYYY-MM
      const endMonth = period.endDate.toISOString().slice(0, 7); // YYYY-MM

      const response = await fetch(
        `http://localhost:8000/api/reports/yearly-budget?start_date=${startMonth}&end_date=${endMonth}&user_id=${session.user.id}`
      );
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      setYearlyData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching the data');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on initial load and when period changes
  useEffect(() => {
    if (session?.user?.email) {
      fetchYearlyBudget();
    }
  }, [session?.user?.email, period]);

  // Filter and sort the yearly data
  const filteredYearlyData = useMemo(() => {
    if (!yearlyData) return null;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return Object.entries(yearlyData)
      .filter(([monthName]) => {
        const [month, yearStr] = monthName.split(' ');
        const year = parseInt(yearStr);
        const monthIndex = monthNames.indexOf(month);
        
        // Create a date object for the first of the month
        const monthDate = new Date(year, monthIndex, 1);
        
        // Compare with start and end dates
        return monthDate >= period.startDate && monthDate <= period.endDate;
      })
      .sort(([aMonthName], [bMonthName]) => {
        const [aMonth, aYearStr] = aMonthName.split(' ');
        const [bMonth, bYearStr] = bMonthName.split(' ');
        const aYear = parseInt(aYearStr);
        const bYear = parseInt(bYearStr);
        const aMonthIndex = monthNames.indexOf(aMonth);
        const bMonthIndex = monthNames.indexOf(bMonth);

        // Compare years first, then months
        if (aYear !== bYear) return aYear - bYear;
        return aMonthIndex - bMonthIndex;
      })
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {} as YearlyBudget);
  }, [yearlyData, period.startDate, period.endDate]);

  // Convert period to format expected by PeriodSelector
  const periodValue = useMemo(() => ({
    startYear: period.startDate.getFullYear(),
    startMonth: period.startDate.getMonth() + 1,
    endYear: period.endDate.getFullYear(),
    endMonth: period.endDate.getMonth() + 1,
  }), [period]);

  // Handle period changes from selector
  const handlePeriodChange = (newValue: any) => {
    setPeriod({
      startDate: new Date(newValue.startYear, newValue.startMonth - 1, 1),
      endDate: new Date(newValue.endYear, newValue.endMonth - 1, 31),
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        <FormattedMessage id="reports.title" />
      </h1>

      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
        <PeriodSelector
          value={periodValue}
          onChange={handlePeriodChange}
          minYear={new Date().getFullYear() - 5}
          maxYear={new Date().getFullYear()}
        />
      </div>

      {isLoading && (
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          {error}
        </div>
      )}

      {filteredYearlyData && (
        <>
          <FinancialChart 
            data={filteredYearlyData} 
            currency={settings?.currency || 'USD'} 
          />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-12 gap-4">
            {Object.entries(filteredYearlyData).map(([monthName, monthData]) => (
              <MonthCard
                key={monthName}
                monthName={monthName}
                data={monthData}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default function ReportsPage() {
  return (
    <ProtectedPage>
      <ErrorBoundary>
        <BudgetReport />
      </ErrorBoundary>
    </ProtectedPage>
  );
} 