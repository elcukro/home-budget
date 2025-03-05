'use client';

import { useState, useEffect } from 'react';
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { validateAmount, validateDescription, validateDate } from '@/utils/validation';
import Tooltip from '@/components/Tooltip';
import { logActivity } from '@/utils/activityLogger';
import { EditableCell } from '@/components/EditableCell';
import { useSettings } from '@/contexts/SettingsContext';
import { FormattedMessage, FormattedNumber, FormattedDate, useIntl } from 'react-intl';
import { TablePageSkeleton } from '@/components/LoadingSkeleton';
import { useSession } from 'next-auth/react';
import { formatCurrency, formatPercentage, getCurrencySymbol } from '@/utils/formatting';

interface Expense {
  id: number;
  category: string;
  description: string;
  amount: number;
  is_recurring: boolean;
  date: string;
  created_at: string;
}

interface ExpenseFormData {
  category: string;
  description: string;
  amount: number;
  is_recurring: boolean;
  date: string;
}

type SortField = 'category' | 'description' | 'amount' | 'date' | 'created_at';
type SortDirection = 'asc' | 'desc';

const categoryOptions = [
  { value: 'housing', label: <FormattedMessage id="expenses.categories.housing" /> },
  { value: 'transportation', label: <FormattedMessage id="expenses.categories.transportation" /> },
  { value: 'food', label: <FormattedMessage id="expenses.categories.food" /> },
  { value: 'utilities', label: <FormattedMessage id="expenses.categories.utilities" /> },
  { value: 'insurance', label: <FormattedMessage id="expenses.categories.insurance" /> },
  { value: 'healthcare', label: <FormattedMessage id="expenses.categories.healthcare" /> },
  { value: 'entertainment', label: <FormattedMessage id="expenses.categories.entertainment" /> },
  { value: 'other', label: <FormattedMessage id="expenses.categories.other" /> }
];

const validateForm = (data: ExpenseFormData): string | null => {
  if (!data.category.trim()) {
    return 'Category is required';
  }
  if (!data.description.trim()) {
    return 'Description is required';
  }
  if (data.amount <= 0) {
    return 'Amount must be greater than 0';
  }
  if (!data.date) {
    return 'Date is required';
  }
  return null;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ExpensesPage() {
  const { formatCurrency, settings } = useSettings();
  const { data: session } = useSession();
  const intl = useIntl();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editForm, setEditForm] = useState<{ [key: number]: ExpenseFormData }>({});
  const [focusField, setFocusField] = useState<string | undefined>();
  const [formData, setFormData] = useState<ExpenseFormData>({
    category: '',
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    is_recurring: false,
  });

  const fetchExpenses = async () => {
    if (!session?.user?.email) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/expenses/`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to fetch expenses');
      }
      const data = await response.json();
      setExpenses(data);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Expenses] Error:', err instanceof Error ? err.message : 'Failed to fetch expenses');
      }
      setError('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session?.user?.email) {
      toast.error('You must be logged in to add an expense');
      return;
    }
    
    const validationError = validateForm(formData);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    console.log('[Expenses] Submitting new expense:', formData);
    const promise = fetch(`${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/expenses/`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    }).then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Expenses] Failed to add expense:', errorText);
        throw new Error(`Failed to add expense: ${errorText}`);
      }
      const newExpense = await response.json();
      console.log('[Expenses] Added new expense:', newExpense);
      setExpenses([...expenses, newExpense]);
      setFormData({
        category: '',
        description: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        is_recurring: false,
      });

      // Log the create activity
      await logActivity({
        entity_type: 'Expense',
        operation_type: 'create',
        entity_id: newExpense.id,
        new_values: {
          category: newExpense.category,
          description: newExpense.description,
          amount: newExpense.amount,
          date: newExpense.date,
          is_recurring: newExpense.is_recurring
        }
      });
    });

    toast.promise(promise, {
      loading: 'Adding expense...',
      success: 'Expense added successfully',
      error: 'Failed to add expense',
    });
  };

  const handleEdit = (expense: Expense, field?: string) => {
    setFocusField(field);
    setEditForm({
      ...editForm,
      [expense.id]: {
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        date: expense.date,
        is_recurring: expense.is_recurring,
      },
    });
  };

  const handleCancelEdit = (expenseId: number) => {
    const newEditForm = { ...editForm };
    delete newEditForm[expenseId];
    setEditForm(newEditForm);
  };

  const handleSaveEdit = async (expenseId: number) => {
    if (!session?.user?.email) {
      toast.error('You must be logged in to edit an expense');
      return;
    }

    const data = editForm[expenseId];
    const previousExpense = expenses.find(expense => expense.id === expenseId);
    
    console.log('[Expenses] Saving edit for expense:', expenseId, data);
    const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/expenses/${expenseId}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Expenses] Failed to update expense:', errorText);
      throw new Error(`Failed to update expense: ${errorText}`);
    }
    
    const newEditForm = { ...editForm };
    delete newEditForm[expenseId];
    setEditForm(newEditForm);
    
    // Log the update activity
    await logActivity({
      entity_type: 'Expense',
      operation_type: 'update',
      entity_id: expenseId,
      previous_values: previousExpense ? { ...previousExpense } : undefined,
      new_values: { ...data }
    });
    
    fetchExpenses();
  };

  const handleDelete = async (expenseId: number) => {
    if (!session?.user?.email) {
      toast.error(intl.formatMessage({ id: 'common.mustBeLoggedIn' }));
      return;
    }

    if (!confirm(intl.formatMessage({ id: 'common.confirmDelete' }))) return;
    
    const previousExpense = expenses.find(expense => expense.id === expenseId);
    console.log('[Expenses] Deleting expense:', expenseId);
    
    const promise = fetch(`${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/expenses/${expenseId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    }).then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Expenses] Failed to delete expense:', errorText);
        throw new Error(intl.formatMessage({ id: 'expenses.errors.deleteFailed' }));
      }
      await fetchExpenses();

      // Log the delete activity
      await logActivity({
        entity_type: 'Expense',
        operation_type: 'delete',
        entity_id: expenseId,
        previous_values: previousExpense ? {
          category: previousExpense.category,
          description: previousExpense.description,
          amount: previousExpense.amount,
          date: previousExpense.date,
          is_recurring: previousExpense.is_recurring
        } as Record<string, unknown> : undefined
      });
    });

    toast.promise(promise, {
      loading: intl.formatMessage({ id: 'expenses.deleting' }),
      success: intl.formatMessage({ id: 'expenses.deleteSuccess' }),
      error: intl.formatMessage({ id: 'expenses.deleteFailed' }),
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

  const getSortedExpenses = () => {
    return [...expenses].sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      
      switch (sortField) {
        case 'category':
          return direction * a.category.localeCompare(b.category);
        case 'description':
          return direction * a.description.localeCompare(b.description);
        case 'amount':
          return direction * (a.amount - b.amount);
        case 'date':
          return direction * (new Date(a.date).getTime() - new Date(b.date).getTime());
        case 'created_at':
          return direction * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        default:
          return 0;
      }
    });
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    
    return sortDirection === 'asc' ? (
      <ChevronUpIcon className="h-4 w-4 inline-block ml-1" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 inline-block ml-1" />
    );
  };

  if (loading) {
    return <TablePageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        <FormattedMessage id="expenses.title" />
      </h1>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md">
          <FormattedMessage id="common.error" values={{ message: error }} />
        </div>
      )}

      {/* Add Expense Form */}
      <div className="bg-white dark:bg-background-primary p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium mb-4 text-default">
          <FormattedMessage id="expenses.addNew" />
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-secondary">
              <FormattedMessage id="expenses.category" />
              <Tooltip content={intl.formatMessage({ id: "expenses.tooltips.category" })} icon={true} />
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="mt-1 block w-full rounded-md border border-default bg-input text-primary px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            >
              <option value="">
                {intl.formatMessage({ id: "common.select" })}
              </option>
              {categoryOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {intl.formatMessage({ id: `expenses.categories.${option.value}` })}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-secondary">
              <FormattedMessage id="expenses.description" />
              <Tooltip content={intl.formatMessage({ id: "expenses.tooltips.description" })} icon={true} />
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
            <label htmlFor="amount" className="block text-sm font-medium text-secondary">
              <FormattedMessage id="expenses.amount" /> ({getCurrencySymbol(settings?.currency)})
              <Tooltip content={intl.formatMessage({ id: "expenses.tooltips.amount" })} icon={true} />
            </label>
            <input
              type="number"
              id="amount"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              className="mt-1 block w-full rounded-md border border-default bg-input text-primary px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
              min="0"
              step="0.01"
            />
          </div>
          
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-secondary">
              <FormattedMessage id="expenses.date" />
              <Tooltip content={intl.formatMessage({ id: "expenses.tooltips.date" })} icon={true} />
            </label>
            <input
              type="date"
              id="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="mt-1 block w-full rounded-md border border-default bg-input text-primary px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_recurring"
              checked={formData.is_recurring}
              onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_recurring" className="ml-2 block text-sm text-gray-700">
              <FormattedMessage id="expenses.recurring" />
              <Tooltip content={intl.formatMessage({ id: "expenses.tooltips.recurring" })} icon={true} />
            </label>
          </div>
          
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <FormattedMessage id="common.add" />
          </button>
        </form>
      </div>

      {/* Expense List */}
      <div className="bg-white dark:bg-background-primary p-6 rounded-lg shadow overflow-hidden">
        <h2 className="text-lg font-medium mb-4 text-default">
          <FormattedMessage id="expenses.expenseHistory" />
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-default">
            <thead className="bg-background-secondary">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('category')}
                >
                  <FormattedMessage id="expenses.category" /> {renderSortIcon('category')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('description')}
                >
                  <FormattedMessage id="expenses.description" /> {renderSortIcon('description')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('amount')}
                >
                  <FormattedMessage id="expenses.amount" /> {renderSortIcon('amount')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('date')}
                >
                  <FormattedMessage id="expenses.date" /> {renderSortIcon('date')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                  <FormattedMessage id="expenses.recurring" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                  <FormattedMessage id="common.actions" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {getSortedExpenses().map((expense) => (
                <tr 
                  key={expense.id} 
                  className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap" onDoubleClick={() => handleEdit(expense, 'category')}>
                    <EditableCell
                      isEditing={!!editForm[expense.id]}
                      value={editForm[expense.id]?.category || expense.category}
                      type="select"
                      options={categoryOptions}
                      onChange={(value) => setEditForm({
                        ...editForm,
                        [expense.id]: { ...editForm[expense.id], category: value }
                      })}
                      onSave={() => handleSaveEdit(expense.id)}
                      onCancel={() => handleCancelEdit(expense.id)}
                      formatter={(value) => <FormattedMessage id={`expenses.categories.${value}`} />}
                      field="category"
                      focusField={focusField}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" onDoubleClick={() => handleEdit(expense, 'description')}>
                    <EditableCell
                      isEditing={!!editForm[expense.id]}
                      value={editForm[expense.id]?.description || expense.description}
                      type="text"
                      onChange={(value) => setEditForm({
                        ...editForm,
                        [expense.id]: { ...editForm[expense.id], description: value }
                      })}
                      onSave={() => handleSaveEdit(expense.id)}
                      onCancel={() => handleCancelEdit(expense.id)}
                      field="description"
                      focusField={focusField}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" onDoubleClick={() => handleEdit(expense, 'amount')}>
                    <EditableCell
                      isEditing={!!editForm[expense.id]}
                      value={editForm[expense.id]?.amount || expense.amount}
                      type="number"
                      onChange={(value) => setEditForm({
                        ...editForm,
                        [expense.id]: { ...editForm[expense.id], amount: value }
                      })}
                      onSave={() => handleSaveEdit(expense.id)}
                      onCancel={() => handleCancelEdit(expense.id)}
                      min={0}
                      step={0.01}
                      formatter={formatCurrency}
                      field="amount"
                      focusField={focusField}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" onDoubleClick={() => handleEdit(expense, 'date')}>
                    <EditableCell
                      isEditing={!!editForm[expense.id]}
                      value={editForm[expense.id]?.date || expense.date}
                      type="date"
                      onChange={(value) => setEditForm({
                        ...editForm,
                        [expense.id]: { ...editForm[expense.id], date: value }
                      })}
                      onSave={() => handleSaveEdit(expense.id)}
                      onCancel={() => handleCancelEdit(expense.id)}
                      formatter={(value) => (
                        <FormattedDate
                          value={value}
                          year="numeric"
                          month="short"
                          day="numeric"
                        />
                      )}
                      field="date"
                      focusField={focusField}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={editForm[expense.id]?.is_recurring || expense.is_recurring}
                      onChange={(e) => {
                        if (editForm[expense.id]) {
                          setEditForm({
                            ...editForm,
                            [expense.id]: { ...editForm[expense.id], is_recurring: e.target.checked }
                          });
                          handleSaveEdit(expense.id);
                        }
                      }}
                      className="rounded border-default bg-input text-blue-600"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[expense.id] ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleSaveEdit(expense.id)}
                          className="text-green-600 hover:text-green-800"
                          title={<FormattedMessage id="common.save" />}
                        >
                          <CheckIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleCancelEdit(expense.id)}
                          className="text-gray-600 hover:text-gray-800"
                          title={<FormattedMessage id="common.cancel" />}
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="text-blue-600 hover:text-blue-800"
                          title={<FormattedMessage id="common.edit" />}
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="text-red-600 hover:text-red-800"
                          title={<FormattedMessage id="common.delete" />}
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    <FormattedMessage id="expenses.noEntries" />
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