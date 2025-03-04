import { useIntl } from 'react-intl';

interface PeriodSelection {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
}

interface PeriodSelectorProps {
  value: PeriodSelection;
  onChange: (newPeriod: PeriodSelection) => void;
  minYear?: number;
  maxYear?: number;
}

export default function PeriodSelector({ value, onChange, minYear, maxYear }: PeriodSelectorProps) {
  const intl = useIntl();
  const currentYear = new Date().getFullYear();
  const effectiveMinYear = minYear || currentYear - 10;
  const effectiveMaxYear = maxYear || currentYear;

  const years = Array.from(
    { length: effectiveMaxYear - effectiveMinYear + 1 },
    (_, i) => effectiveMinYear + i
  );

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleStartYearChange = (newYear: number) => {
    onChange({
      ...value,
      startYear: newYear,
      // If end year is before new start year, update it
      endYear: value.endYear < newYear ? newYear : value.endYear,
      // If same year and end month before start month, update end month
      endMonth: newYear === value.endYear && value.endMonth < value.startMonth ? value.startMonth : value.endMonth
    });
  };

  const handleStartMonthChange = (newMonth: number) => {
    onChange({
      ...value,
      startMonth: newMonth,
      // If same year and end month before new start month, update end month
      endMonth: value.startYear === value.endYear && value.endMonth < newMonth ? newMonth : value.endMonth
    });
  };

  const handleEndYearChange = (newYear: number) => {
    onChange({
      ...value,
      endYear: newYear,
      // If new end year is before start year, update start year
      startYear: newYear < value.startYear ? newYear : value.startYear,
      // If same year and start month after end month, update start month
      startMonth: newYear === value.startYear && value.startMonth > value.endMonth ? value.endMonth : value.startMonth
    });
  };

  const handleEndMonthChange = (newMonth: number) => {
    onChange({
      ...value,
      endMonth: newMonth,
      // If same year and start month after new end month, update start month
      startMonth: value.startYear === value.endYear && value.startMonth > newMonth ? newMonth : value.startMonth
    });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-background-primary p-4 rounded-lg shadow-sm">
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {intl.formatMessage({ id: 'reports.period.from' })}
        </div>
        <div className="flex gap-2">
          <select
            value={value.startYear}
            onChange={(e) => handleStartYearChange(Number(e.target.value))}
            className="flex-1 rounded-md border border-default bg-input text-primary px-3 py-2 text-sm"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <select
            value={value.startMonth}
            onChange={(e) => handleStartMonthChange(Number(e.target.value))}
            className="flex-1 rounded-md border border-default bg-input text-primary px-3 py-2 text-sm"
          >
            {months.map((month) => (
              <option key={month} value={month}>
                {intl.formatMessage({ id: `reports.months.${month}` })}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {intl.formatMessage({ id: 'reports.period.to' })}
        </div>
        <div className="flex gap-2">
          <select
            value={value.endYear}
            onChange={(e) => handleEndYearChange(Number(e.target.value))}
            className="flex-1 rounded-md border border-default bg-input text-primary px-3 py-2 text-sm"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <select
            value={value.endMonth}
            onChange={(e) => handleEndMonthChange(Number(e.target.value))}
            className="flex-1 rounded-md border border-default bg-input text-primary px-3 py-2 text-sm"
          >
            {months.map((month) => (
              <option key={month} value={month}>
                {intl.formatMessage({ id: `reports.months.${month}` })}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
} 