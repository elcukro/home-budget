'use client';

import { useState, useEffect } from 'react';
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import {
  validateAmount,
  validateDescription,
  validateDate,
  validateInterestRate,
  validateMonthlyPayment,
  validateRemainingBalance,
} from '@/utils/validation';
import Tooltip from '@/components/Tooltip';
import { EditableCell } from '@/components/EditableCell';
import { logActivity } from '@/utils/activityLogger';
import { useSettings } from '@/contexts/SettingsContext';
import { FormattedMessage, FormattedNumber, FormattedDate, useIntl } from 'react-intl';
import { TablePageSkeleton } from '@/components/LoadingSkeleton';
import { useSession } from 'next-auth/react';
import { formatCurrency, formatPercentage, getCurrencySymbol } from '@/utils/formatting';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface LoanFormData {
  loan_type: string;
  description: string;
  principal_amount: number;
  remaining_balance: number;
  interest_rate: number;
  monthly_payment: number;
  start_date: string;
  term_months: number;
}

interface Loan extends LoanFormData {
  id: number;
  user_id: string;
  created_at: string | Date;
  updated_at: string | Date | null;
}

type SortField = 'loan_type' | 'description' | 'principal_amount' | 'remaining_balance' | 'interest_rate' | 'monthly_payment' | 'term_months' | 'start_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

export default function LoansPage() {
  const { formatCurrency, settings } = useSettings();
  const { data: session } = useSession();
  const intl = useIntl();

  const loanTypeOptions = [
    { value: 'mortgage', label: intl.formatMessage({ id: 'loans.types.mortgage' }) },
    { value: 'car', label: intl.formatMessage({ id: 'loans.types.car' }) },
    { value: 'personal', label: intl.formatMessage({ id: 'loans.types.personal' }) },
    { value: 'student', label: intl.formatMessage({ id: 'loans.types.student' }) },
    { value: 'other', label: intl.formatMessage({ id: 'loans.types.other' }) }
  ];

  const [loans, setLoans] = useState<Loan[]>([]);
  const [formData, setFormData] = useState<LoanFormData>({
    loan_type: '',
    description: '',
    principal_amount: 0,
    remaining_balance: 0,
    interest_rate: 0,
    monthly_payment: 0,
    start_date: new Date().toISOString().split('T')[0],
    term_months: 0,
  });
  const [editForm, setEditForm] = useState<{ [key: number]: LoanFormData }>({});
  const [focusField, setFocusField] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    const fetchLoans = async () => {
      if (!session?.user?.email) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/loans/`);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to fetch loans');
        }
        const data = await response.json();
        setLoans(data);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Loans] Error:', err instanceof Error ? err.message : 'Failed to fetch loans');
        }
        setError('Failed to load loans');
      } finally {
        setLoading(false);
      }
    };

    fetchLoans();
  }, [session]);

  const validateForm = (data: LoanFormData): string | null => {
    const descriptionError = validateDescription(data.description);
    if (descriptionError) return descriptionError;

    const amountError = validateAmount(data.principal_amount);
    if (amountError) return amountError;

    const remainingBalanceError = validateRemainingBalance(data.remaining_balance, data.principal_amount);
    if (remainingBalanceError) return remainingBalanceError;

    const interestRateError = validateInterestRate(data.interest_rate);
    if (interestRateError) return interestRateError;

    const monthlyPaymentError = validateMonthlyPayment(data.monthly_payment, data.principal_amount);
    if (monthlyPaymentError) return monthlyPaymentError;

    const dateError = validateDate(data.start_date);
    if (dateError) return dateError;

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session?.user?.email) {
      console.error('[LoansPage] Cannot submit: No user email available');
      toast.error('You must be logged in to add a loan');
      return;
    }

    console.log('[LoansPage] Submitting new loan:', formData);
    const validationError = validateForm(formData);
    if (validationError) {
      console.log('[LoansPage] Validation error:', validationError);
      toast.error(validationError);
      return;
    }

    const url = `${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/loans/`;
    console.log('[LoansPage] Submit URL:', url);

    const promise = fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    }).then(async (response) => {
      console.log('[LoansPage] Submit response status:', response.status);
      
      if (!response.ok) {
        throw new Error(intl.formatMessage({ id: 'loans.addFailed' }));
      }
      
      const newLoan = await response.json();
      console.log('[LoansPage] New loan created:', newLoan);
      setLoans([...loans, newLoan]);
      setFormData({
        loan_type: '',
        description: '',
        principal_amount: 0,
        remaining_balance: 0,
        interest_rate: 0,
        monthly_payment: 0,
        start_date: new Date().toISOString().split('T')[0],
        term_months: 0,
      });

      // Log the create activity
      await logActivity({
        entity_type: 'Loan',
        operation_type: 'create',
        entity_id: newLoan.id,
        new_values: {
          loan_type: newLoan.loan_type,
          description: newLoan.description,
          principal_amount: newLoan.principal_amount,
          remaining_balance: newLoan.remaining_balance,
          interest_rate: newLoan.interest_rate,
          monthly_payment: newLoan.monthly_payment,
          start_date: newLoan.start_date,
          term_months: newLoan.term_months
        }
      });
    });

    toast.promise(promise, {
      loading: intl.formatMessage({ id: 'loans.adding' }),
      success: intl.formatMessage({ id: 'loans.addSuccess' }),
      error: intl.formatMessage({ id: 'loans.addFailed' }),
    });
  };

  const handleEdit = (loan: Loan, field?: string) => {
    console.log('[LoansPage] Starting edit for loan:', loan.id, 'field:', field);
    setFocusField(field);
    setEditForm({
      ...editForm,
      [loan.id]: {
        loan_type: loan.loan_type,
        description: loan.description,
        principal_amount: loan.principal_amount,
        remaining_balance: loan.remaining_balance,
        interest_rate: loan.interest_rate,
        monthly_payment: loan.monthly_payment,
        start_date: loan.start_date,
        term_months: loan.term_months,
      },
    });
  };

  const handleCancelEdit = (loanId: number) => {
    console.log('[LoansPage] Canceling edit for loan:', loanId);
    const newEditForm = { ...editForm };
    delete newEditForm[loanId];
    setEditForm(newEditForm);
  };

  const handleSaveEdit = async (loanId: number) => {
    if (!session?.user?.email) {
      console.error('[LoansPage] Cannot save edit: No user email available');
      return;
    }

    const data = editForm[loanId];
    console.log('[LoansPage] Saving edit for loan:', loanId, 'data:', data);

    const validationError = validateForm(data);
    if (validationError) {
      console.log('[LoansPage] Validation error:', validationError);
      toast.error(validationError);
      return;
    }

    const url = `${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/loans/${loanId}`;
    console.log('[LoansPage] Save edit URL:', url);

    const promise = fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(async (response) => {
      console.log('[LoansPage] Save edit response status:', response.status);
      
      if (!response.ok) {
        throw new Error(intl.formatMessage({ id: 'loans.updateFailed' }));
      }
      
      const updatedLoan = await response.json();
      console.log('[LoansPage] Loan updated:', updatedLoan);
      
      setLoans(loans.map(loan => 
        loan.id === loanId ? updatedLoan : loan
      ));
      
      const newEditForm = { ...editForm };
      delete newEditForm[loanId];
      setEditForm(newEditForm);

      // Log the update activity
      const previousLoan = loans.find(loan => loan.id === loanId);
      await logActivity({
        entity_type: 'Loan',
        operation_type: 'update',
        entity_id: loanId,
        previous_values: previousLoan ? { ...previousLoan } : undefined,
        new_values: { ...updatedLoan }
      });
    });

    toast.promise(promise, {
      loading: intl.formatMessage({ id: 'loans.updating' }),
      success: intl.formatMessage({ id: 'loans.updateSuccess' }),
      error: intl.formatMessage({ id: 'loans.updateFailed' }),
    });
  };

  const handleDelete = async (loanId: number) => {
    if (!session?.user?.email) {
      console.error('[LoansPage] Cannot delete: No user email available');
      toast.error(intl.formatMessage({ id: 'common.mustBeLoggedIn' }));
      return;
    }

    if (!confirm(intl.formatMessage({ id: 'common.confirmDelete' }))) return;
    
    console.log('[LoansPage] Deleting loan:', loanId);
    const previousLoan = loans.find(loan => loan.id === loanId);
    console.log('[LoansPage] Previous loan data:', previousLoan);

    const url = `${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/loans/${loanId}`;
    console.log('[LoansPage] Delete URL:', url);

    const promise = fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    }).then(async (response) => {
      console.log('[LoansPage] Delete response status:', response.status);
      
      if (!response.ok) {
        throw new Error(intl.formatMessage({ id: 'loans.deleteFailed' }));
      }
      
      setLoans(loans.filter(loan => loan.id !== loanId));

      // Log the delete activity
      await logActivity({
        entity_type: 'Loan',
        operation_type: 'delete',
        entity_id: loanId,
        previous_values: previousLoan ? { ...previousLoan } : undefined
      });
    });

    toast.promise(promise, {
      loading: intl.formatMessage({ id: 'loans.deleting' }),
      success: intl.formatMessage({ id: 'loans.deleteSuccess' }),
      error: intl.formatMessage({ id: 'loans.deleteFailed' }),
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    
    return sortDirection === 'asc' ? (
      <ChevronUpIcon className="h-4 w-4 inline-block ml-1" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 inline-block ml-1" />
    );
  };

  const sortedLoans = [...loans].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    return sortDirection === 'asc'
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number);
  });

  const formatLoanCurrency = (amount: number) => {
    return formatCurrency(amount);
  };

  if (loading) {
    return <TablePageSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        <FormattedMessage id="loans.title" />
      </h1>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md">
          <FormattedMessage id="common.error" values={{ message: error }} />
        </div>
      )}

      {/* Add Loan Form */}
      <div className="bg-white dark:bg-background-primary p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium mb-4 text-default">
          <FormattedMessage id="loans.addNew" />
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="loan_type" className="block text-sm font-medium text-secondary">
              {intl.formatMessage({ id: "loans.loanType" })}
              <Tooltip content={intl.formatMessage({ id: "loans.tooltips.loanType" })} icon={true} />
            </label>
            <select
              id="loan_type"
              value={formData.loan_type}
              onChange={(e) => setFormData({ ...formData, loan_type: e.target.value })}
              className="mt-1 block w-full rounded-md border border-default bg-input text-primary px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            >
              <option value="">
                {intl.formatMessage({ id: "common.select" })}
              </option>
              {loanTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-secondary">
              {intl.formatMessage({ id: "loans.description" })}
              <Tooltip content={intl.formatMessage({ id: "loans.tooltips.description" })} icon={true} />
            </label>
            <input
              type="text"
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 block w-full rounded-md border border-default bg-input text-primary px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="principal_amount" className="block text-sm font-medium text-secondary">
              {intl.formatMessage({ id: "loans.principalAmount" })} ({getCurrencySymbol(settings?.currency)})
              <Tooltip content={intl.formatMessage({ id: "loans.tooltips.principalAmount" })} icon={true} />
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                id="principal_amount"
                value={formData.principal_amount || ''}
                onChange={(e) => setFormData({ ...formData, principal_amount: Number(e.target.value) })}
                className="block w-full rounded-md border border-default bg-input text-primary px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="remaining_balance" className="block text-sm font-medium text-secondary">
              {intl.formatMessage({ id: "loans.remainingBalance" })} ({getCurrencySymbol(settings?.currency)})
              <Tooltip content={intl.formatMessage({ id: "loans.tooltips.remainingBalance" })} icon={true} />
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                id="remaining_balance"
                value={formData.remaining_balance || ''}
                onChange={(e) => setFormData({ ...formData, remaining_balance: Number(e.target.value) })}
                className="block w-full rounded-md border border-default bg-input text-primary px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="interest_rate" className="block text-sm font-medium text-secondary">
              {intl.formatMessage({ id: "loans.interestRate" })} (%)
              <Tooltip content={intl.formatMessage({ id: "loans.tooltips.interestRate" })} icon={true} />
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                id="interest_rate"
                value={formData.interest_rate || ''}
                onChange={(e) => setFormData({ ...formData, interest_rate: Number(e.target.value) })}
                className="block w-full rounded-md border border-default bg-input text-primary px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="monthly_payment" className="block text-sm font-medium text-secondary">
              {intl.formatMessage({ id: "loans.monthlyPayment" })} ({getCurrencySymbol(settings?.currency)})
              <Tooltip content={intl.formatMessage({ id: "loans.tooltips.monthlyPayment" })} icon={true} />
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                id="monthly_payment"
                value={formData.monthly_payment || ''}
                onChange={(e) => setFormData({ ...formData, monthly_payment: Number(e.target.value) })}
                className="block w-full rounded-md border border-default bg-input text-primary px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="start_date" className="block text-sm font-medium text-secondary">
              {intl.formatMessage({ id: "loans.startDate" })}
              <Tooltip content={intl.formatMessage({ id: "loans.tooltips.startDate" })} icon={true} />
            </label>
            <input
              type="date"
              id="start_date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="mt-1 block w-full rounded-md border border-default bg-input text-primary px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="term_months" className="block text-sm font-medium text-secondary">
              {intl.formatMessage({ id: "loans.termMonths" })}
              <Tooltip content={intl.formatMessage({ id: "loans.tooltips.termMonths" })} icon={true} />
            </label>
            <input
              type="number"
              id="term_months"
              value={formData.term_months}
              onChange={(e) => setFormData({ ...formData, term_months: Number(e.target.value) })}
              className="mt-1 block w-full rounded-md border border-default bg-input text-primary px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              min="1"
              required
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <FormattedMessage id="common.add" />
            </button>
          </div>
        </form>
      </div>

      {/* Loan List */}
      <div className="bg-white dark:bg-background-primary p-6 rounded-lg shadow overflow-hidden">
        <h2 className="text-lg font-medium mb-4 text-default">
          <FormattedMessage id="loans.loanHistory" />
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-default">
            <thead className="bg-background-secondary">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('loan_type')}
                >
                  <div className="flex items-center">
                    {intl.formatMessage({ id: "loans.loanType" })}
                    {renderSortIcon('loan_type')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('description')}
                >
                  <div className="flex items-center">
                    {intl.formatMessage({ id: "loans.description" })}
                    {renderSortIcon('description')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('principal_amount')}
                >
                  <div className="flex items-center">
                    {intl.formatMessage({ id: "loans.principalAmount" })}
                    {renderSortIcon('principal_amount')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('remaining_balance')}
                >
                  <div className="flex items-center">
                    {intl.formatMessage({ id: "loans.remainingBalance" })}
                    {renderSortIcon('remaining_balance')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('interest_rate')}
                >
                  <div className="flex items-center">
                    {intl.formatMessage({ id: "loans.interestRate" })}
                    {renderSortIcon('interest_rate')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('monthly_payment')}
                >
                  <div className="flex items-center">
                    {intl.formatMessage({ id: "loans.monthlyPayment" })}
                    {renderSortIcon('monthly_payment')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('term_months')}
                >
                  <div className="flex items-center">
                    {intl.formatMessage({ id: "loans.termMonths" })}
                    {renderSortIcon('term_months')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('start_date')}
                >
                  <div className="flex items-center">
                    {intl.formatMessage({ id: "loans.startDate" })}
                    {renderSortIcon('start_date')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center">
                    {intl.formatMessage({ id: "common.createdAt" })}
                    {renderSortIcon('created_at')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                  <div className="flex items-center">
                    {intl.formatMessage({ id: "common.actions" })}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {sortedLoans.map((loan) => (
                <tr 
                  key={loan.id} 
                  className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap" onDoubleClick={() => handleEdit(loan, 'loan_type')}>
                    <EditableCell
                      isEditing={!!editForm[loan.id]}
                      value={editForm[loan.id]?.loan_type || loan.loan_type}
                      type="select"
                      options={loanTypeOptions}
                      onChange={(value) => setEditForm({
                        ...editForm,
                        [loan.id]: { ...editForm[loan.id], loan_type: value }
                      })}
                      onSave={() => handleSaveEdit(loan.id)}
                      onCancel={() => handleCancelEdit(loan.id)}
                      field="loan_type"
                      focusField={focusField}
                      formatter={(value) => intl.formatMessage({ id: `loans.types.${value}` })}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" onDoubleClick={() => handleEdit(loan, 'description')}>
                    <EditableCell
                      isEditing={!!editForm[loan.id]}
                      value={editForm[loan.id]?.description || loan.description}
                      type="text"
                      onChange={(value) => setEditForm({
                        ...editForm,
                        [loan.id]: { ...editForm[loan.id], description: value }
                      })}
                      onSave={() => handleSaveEdit(loan.id)}
                      onCancel={() => handleCancelEdit(loan.id)}
                      field="description"
                      focusField={focusField}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" onDoubleClick={() => handleEdit(loan, 'principal_amount')}>
                    <EditableCell
                      isEditing={!!editForm[loan.id]}
                      value={editForm[loan.id]?.principal_amount || loan.principal_amount}
                      type="number"
                      onChange={(value) => setEditForm({
                        ...editForm,
                        [loan.id]: { ...editForm[loan.id], principal_amount: Number(value) }
                      })}
                      onSave={() => handleSaveEdit(loan.id)}
                      onCancel={() => handleCancelEdit(loan.id)}
                      min={0}
                      step={0.01}
                      formatter={formatLoanCurrency}
                      field="principal_amount"
                      focusField={focusField}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" onDoubleClick={() => handleEdit(loan, 'remaining_balance')}>
                    <EditableCell
                      isEditing={!!editForm[loan.id]}
                      value={editForm[loan.id]?.remaining_balance || loan.remaining_balance}
                      type="number"
                      onChange={(value) => setEditForm({
                        ...editForm,
                        [loan.id]: { ...editForm[loan.id], remaining_balance: Number(value) }
                      })}
                      onSave={() => handleSaveEdit(loan.id)}
                      onCancel={() => handleCancelEdit(loan.id)}
                      min={0}
                      step={0.01}
                      formatter={formatLoanCurrency}
                      field="remaining_balance"
                      focusField={focusField}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" onDoubleClick={() => handleEdit(loan, 'interest_rate')}>
                    <EditableCell
                      isEditing={!!editForm[loan.id]}
                      value={editForm[loan.id]?.interest_rate || loan.interest_rate}
                      type="number"
                      onChange={(value) => setEditForm({
                        ...editForm,
                        [loan.id]: { ...editForm[loan.id], interest_rate: Number(value) }
                      })}
                      onSave={() => handleSaveEdit(loan.id)}
                      onCancel={() => handleCancelEdit(loan.id)}
                      min={0}
                      step={0.01}
                      formatter={formatPercentage}
                      field="interest_rate"
                      focusField={focusField}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" onDoubleClick={() => handleEdit(loan, 'monthly_payment')}>
                    <EditableCell
                      isEditing={!!editForm[loan.id]}
                      value={editForm[loan.id]?.monthly_payment || loan.monthly_payment}
                      type="number"
                      onChange={(value) => setEditForm({
                        ...editForm,
                        [loan.id]: { ...editForm[loan.id], monthly_payment: Number(value) }
                      })}
                      onSave={() => handleSaveEdit(loan.id)}
                      onCancel={() => handleCancelEdit(loan.id)}
                      min={0}
                      step={0.01}
                      formatter={formatLoanCurrency}
                      field="monthly_payment"
                      focusField={focusField}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" onDoubleClick={() => handleEdit(loan, 'term_months')}>
                    <EditableCell
                      isEditing={!!editForm[loan.id]}
                      value={editForm[loan.id]?.term_months || loan.term_months}
                      type="number"
                      onChange={(value) => setEditForm({
                        ...editForm,
                        [loan.id]: { ...editForm[loan.id], term_months: Number(value) }
                      })}
                      onSave={() => handleSaveEdit(loan.id)}
                      onCancel={() => handleCancelEdit(loan.id)}
                      min={1}
                      field="term_months"
                      focusField={focusField}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" onDoubleClick={() => handleEdit(loan, 'start_date')}>
                    <EditableCell
                      isEditing={!!editForm[loan.id]}
                      value={editForm[loan.id]?.start_date || loan.start_date}
                      type="date"
                      onChange={(value) => setEditForm({
                        ...editForm,
                        [loan.id]: { ...editForm[loan.id], start_date: value }
                      })}
                      onSave={() => handleSaveEdit(loan.id)}
                      onCancel={() => handleCancelEdit(loan.id)}
                      formatter={(value) => new Date(value).toLocaleDateString()}
                      field="start_date"
                      focusField={focusField}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {typeof loan.created_at === 'string' 
                      ? new Date(loan.created_at).toLocaleDateString()
                      : loan.created_at.toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[loan.id] ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleSaveEdit(loan.id)}
                          className="text-green-600 hover:text-green-800"
                          title={intl.formatMessage({ id: "common.save" })}
                        >
                          <CheckIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleCancelEdit(loan.id)}
                          className="text-gray-600 hover:text-gray-800"
                          title={intl.formatMessage({ id: "common.cancel" })}
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(loan)}
                          className="text-blue-600 hover:text-blue-800"
                          title={intl.formatMessage({ id: "common.edit" })}
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(loan.id)}
                          className="text-red-600 hover:text-red-800"
                          title={intl.formatMessage({ id: "common.delete" })}
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {loans.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-4 text-center text-gray-500">
                    <FormattedMessage id="loans.noEntries" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 