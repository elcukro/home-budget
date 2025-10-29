'use client';

import { useIntl } from 'react-intl';

interface LoanData {
  id: string;
  description: string;
  balance: number;
  monthlyPayment: number;
  interestRate: number;
  progress: number;
  totalAmount: number;
}

interface LoanOverviewProps {
  loans: LoanData[];
  formatCurrency: (amount: number) => string;
}

export default function LoanOverview({ loans, formatCurrency }: LoanOverviewProps) {
  const intl = useIntl();

  const totalBalance = loans.reduce((sum, loan) => sum + loan.balance, 0);
  const totalMonthlyPayments = loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0);

  return (
    <div className="bg-card border border-default p-6 rounded-lg shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-primary">
          {intl.formatMessage({ id: 'dashboard.loans.title' })}
        </h2>
        <div className="text-right">
          <p className="text-sm text-secondary">
            {intl.formatMessage({ id: 'dashboard.loans.totalBalance' })}
          </p>
          <p className="text-xl font-semibold text-primary">
            {formatCurrency(totalBalance)}
          </p>
        </div>
      </div>

      <div className="space-y-4 flex-grow">
        {loans.length === 0 ? (
          <p className="text-secondary text-center py-4">
            {intl.formatMessage({ id: 'dashboard.loans.noLoans' })}
          </p>
        ) : (
          <>
            {loans.map((loan) => (
              <div key={loan.id} className="border border-default rounded-lg p-4 bg-muted">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-medium text-primary">
                      {loan.description}
                    </h3>
                    <p className="text-sm text-secondary">
                      {intl.formatMessage(
                        { id: 'dashboard.loans.interestRate' },
                        { rate: loan.interestRate.toFixed(2) }
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-primary">
                      {formatCurrency(loan.balance)}
                    </p>
                    <p className="text-sm text-secondary">
                      {intl.formatMessage(
                        { id: 'dashboard.loans.monthlyPayment' },
                        { amount: formatCurrency(loan.monthlyPayment) }
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-secondary mb-1">
                    <span>
                      {intl.formatMessage(
                        { id: 'dashboard.loans.progress' },
                        { percentage: Math.round(loan.progress * 100) }
                      )}
                    </span>
                    <span>{formatCurrency(loan.totalAmount)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${loan.progress * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="mt-4 pt-4 border-t border-default">
              <div className="flex justify-between items-center text-sm">
                <span className="text-secondary">
                  {intl.formatMessage({ id: 'dashboard.loans.totalMonthlyPayments' })}
                </span>
                <span className="font-medium text-primary">
                  {formatCurrency(totalMonthlyPayments)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 
