'use client';

import { useState, useEffect } from 'react';
import { useIntl, FormattedMessage, FormattedDate } from 'react-intl';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ChevronUpIcon, ChevronDownIcon, CheckIcon, XMarkIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { TablePageSkeleton } from '@/components/LoadingSkeleton';
import Tooltip from '@/components/Tooltip';
import { EditableCell } from '@/components/EditableCell';
import { useSettings } from '@/contexts/SettingsContext';
import { getCurrencySymbol } from '@/utils/formatting';
import { toast } from 'react-hot-toast';
import { logActivity } from '@/utils/activityLogger';

interface Income {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  is_recurring: boolean;
  created_at: string;
}

interface EditForm {
  [key: string]: {
    category: string;
    description: string;
    amount: number;
    date: string;
    is_recurring: boolean;
  };
}

export default function IncomePage() {
  const { data: session } = useSession();
  const intl = useIntl();
  const router = useRouter();
  const { formatCurrency, settings } = useSettings();
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof Income>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [editForm, setEditForm] = useState<EditForm>({});
  const [focusField, setFocusField] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    is_recurring: false
  });

  const validateDescription = (description: string): string | null => {
    if (!description.trim()) {
      return intl.formatMessage({ id: 'validation.required' });
    }
    return null;
  };

  const validateAmount = (amount: string): string | null => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return intl.formatMessage({ id: 'validation.positiveNumber' });
    }
    return null;
  };

  const validateDate = (date: string): string | null => {
    if (!date) {
      return intl.formatMessage({ id: 'validation.required' });
    }
    return null;
  };

  const handleEdit = (id: string, field?: string) => {
    const income = incomes.find(i => i.id === id);
    if (income) {
      setEditForm({
        ...editForm,
        [id]: {
          category: income.category,
          description: income.description,
          amount: income.amount,
          date: income.date,
          is_recurring: income.is_recurring
        }
      });
      if (field && field !== 'all') {
        setFocusField(field);
      }
    }
  };

  const handleEditChange = (id: string, field: keyof EditForm[string], value: any) => {
    setEditForm({
      ...editForm,
      [id]: {
        ...editForm[id],
        [field]: value
      }
    });
  };

  const handleBlur = (id: string, field: string) => {
    setFocusField(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string, field: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(id);
    } else if (e.key === 'Escape') {
      handleCancelEdit(id);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!session?.user?.email) {
      toast.error(intl.formatMessage({ id: 'common.mustBeLoggedIn' }));
      return;
    }

    const editedIncome = editForm[id];
    if (!editedIncome) return;

    try {
      const previousIncome = incomes.find(income => income.id === id);
      console.log('[Income] Starting update for income:', {
        id,
        id_type: typeof id,
        previous: previousIncome,
        edited: editedIncome
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${encodeURIComponent(session.user.email)}/income/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(editedIncome),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Income] Failed to update income:', errorText);
        throw new Error(intl.formatMessage({ id: 'income.errors.updateFailed' }));
      }

      const updatedIncome = await response.json();
      
      // Log the update activity
      console.log('[Income] Preparing activity log for update:', {
        id,
        previous_values: previousIncome ? { ...previousIncome } : undefined,
        new_values: { ...updatedIncome }
      });

      await logActivity({
        entity_type: 'Income',
        operation_type: 'update',
        entity_id: parseInt(id),
        previous_values: previousIncome ? { ...previousIncome } : undefined,
        new_values: { ...updatedIncome }
      });
      console.log('[Income] Update activity logged successfully');

      setIncomes(incomes.map(income => 
        income.id === id ? updatedIncome : income
      ));
      setEditForm({});
      setFocusField(null);
      toast.success(intl.formatMessage({ id: 'income.updateSuccess' }));
    } catch (error) {
      console.error('[Income] Error updating income:', error);
      toast.error(intl.formatMessage({ id: 'income.errors.updateFailed' }));
    }
  };

  const handleCancelEdit = (id: string) => {
    setEditForm({});
    setFocusField(null);
  };

  const handleDelete = async (id: string) => {
    if (!session?.user?.email) {
      toast.error(intl.formatMessage({ id: 'common.mustBeLoggedIn' }));
      return;
    }

    if (!confirm(intl.formatMessage({ id: 'common.confirmDelete' }))) {
      return;
    }

    try {
      const incomeToDelete = incomes.find(income => income.id === id);
      console.log('Income record to delete:', incomeToDelete);
      console.log('ID type:', typeof id);
      console.log('ID value:', id);
      console.log('ID length:', id.length);
      
      const response = await fetch(`/api/income/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: session.user.email }),
      });

      console.log('Delete response status:', response.status);
      const data = await response.json();
      console.log('Delete response data:', data);

      if (!response.ok) {
        throw new Error(intl.formatMessage({ id: 'income.errors.deleteFailed' }));
      }

      // Log the delete activity
      console.log('[Income] Logging delete activity for:', {
        id,
        deleted: incomeToDelete
      });
      await logActivity({
        entity_type: 'Income',
        operation_type: 'delete',
        entity_id: parseInt(id),
        previous_values: incomeToDelete ? Object.assign({}, incomeToDelete) : undefined
      });
      console.log('[Income] Delete activity logged successfully');

      setIncomes(incomes.filter(income => income.id !== id));
      toast.success(intl.formatMessage({ id: 'income.deleteSuccess' }));
    } catch (error) {
      console.error('Error deleting income:', error);
      toast.error(intl.formatMessage({ id: 'income.deleteFailed' }));
    }
  };

  const handleSort = (field: keyof Income) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await fetch('/api/income', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          email: session?.user?.email
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create income');
      }

      const newIncome = await response.json();
      
      // Log the create activity
      console.log('[Income] Logging create activity for:', newIncome);
      await logActivity({
        entity_type: 'Income',
        operation_type: 'create',
        entity_id: parseInt(newIncome.id),
        new_values: {
          category: newIncome.category,
          description: newIncome.description,
          amount: newIncome.amount,
          date: newIncome.date,
          is_recurring: newIncome.is_recurring
        }
      });
      console.log('[Income] Create activity logged successfully');
      
      setIncomes([...incomes, newIncome]);
      setFormData({
        category: '',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        is_recurring: false
      });
      toast.success(intl.formatMessage({ id: 'income.createSuccess' }));
    } catch (error) {
      console.error('[Income] Error creating income:', error);
      toast.error(intl.formatMessage({ id: 'income.errors.createFailed' }));
    }
  };

  useEffect(() => {
    const fetchIncomes = async () => {
      if (!session?.user?.email) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/income?email=${encodeURIComponent(session.user.email)}`);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to fetch income');
        }
        const data = await response.json();
        setIncomes(data);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Income] Error:', err instanceof Error ? err.message : 'Failed to fetch income');
        }
        setError('Failed to load income');
      } finally {
        setLoading(false);
      }
    };

    fetchIncomes();
  }, [session]);

  if (loading) {
    return <TablePageSkeleton />;
  }

  const sortedIncomes = [...incomes].sort((a, b) => {
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

  const renderSortIcon = (field: keyof Income) => {
    if (sortField === field) {
      return sortDirection === 'asc' 
        ? <ChevronUpIcon className="w-4 h-4" /> 
        : <ChevronDownIcon className="w-4 h-4" />;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        <FormattedMessage id="income.title" />
      </h1>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md">
          <FormattedMessage id="common.error" values={{ message: error }} />
        </div>
      )}

      <div className="bg-white dark:bg-background-primary p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium mb-4 text-default">
          <FormattedMessage id="income.addNew" />
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <FormattedMessage id="income.category" />
              <Tooltip content={intl.formatMessage({ id: "income.tooltips.source" })} icon={true} />
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              required
            >
              <option value="">{intl.formatMessage({ id: 'income.form.category.select' })}</option>
              <option value="salary">{intl.formatMessage({ id: 'income.categories.salary' })}</option>
              <option value="freelance">{intl.formatMessage({ id: 'income.categories.freelance' })}</option>
              <option value="investments">{intl.formatMessage({ id: 'income.categories.investments' })}</option>
              <option value="rental">{intl.formatMessage({ id: 'income.categories.rental' })}</option>
              <option value="other">{intl.formatMessage({ id: 'income.categories.other' })}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <FormattedMessage id="income.description" />
              <Tooltip content={intl.formatMessage({ id: "income.tooltips.source" })} icon={true} />
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <FormattedMessage id="income.amount" /> ({getCurrencySymbol(settings?.currency)})
              <Tooltip content={intl.formatMessage({ id: "income.tooltips.amount" })} icon={true} />
            </label>
            <div className="relative">
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                required
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <FormattedMessage id="income.date" />
              <Tooltip content={intl.formatMessage({ id: "income.tooltips.date" })} icon={true} />
            </label>
            <div className="relative">
              <style jsx>{`
                input[type="date"]::-webkit-calendar-picker-indicator {
                  position: absolute;
                  right: 0;
                  padding-right: 0.5rem;
                  cursor: pointer;
                }
              `}</style>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                required
              />
            </div>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_recurring"
              checked={formData.is_recurring}
              onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <label htmlFor="is_recurring" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              <FormattedMessage id="income.form.recurring" />
              <Tooltip content={intl.formatMessage({ id: "income.tooltips.recurring" })} icon={true} />
            </label>
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

      <div className="bg-white dark:bg-background-primary p-6 rounded-lg shadow overflow-hidden">
        <h2 className="text-lg font-medium mb-4 text-default">
          <FormattedMessage id="income.incomeHistory" />
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-default">
            <thead className="bg-background-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer">
                  <button
                    onClick={() => handleSort('category')}
                    className="flex items-center"
                  >
                    <FormattedMessage id="income.category" />
                    {renderSortIcon('category')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('description')}
                    className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <FormattedMessage id="income.description" />
                    {renderSortIcon('description')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('amount')}
                    className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <FormattedMessage id="income.amount" />
                    {renderSortIcon('amount')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('date')}
                    className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <FormattedMessage id="income.date" />
                    {renderSortIcon('date')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <FormattedMessage id="income.recurring" />
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <FormattedMessage id="common.actions" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {sortedIncomes.map((income) => (
                <tr 
                  key={income.id} 
                  className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                >
                  <td 
                    className="px-6 py-4 whitespace-nowrap"
                    onDoubleClick={() => handleEdit(income.id, 'category')}
                  >
                    {editForm[income.id] ? (
                      <EditableCell
                        value={editForm[income.id].category}
                        type="select"
                        options={[
                          { value: 'salary', label: intl.formatMessage({ id: 'income.categories.salary' }) },
                          { value: 'freelance', label: intl.formatMessage({ id: 'income.categories.freelance' }) },
                          { value: 'investments', label: intl.formatMessage({ id: 'income.categories.investments' }) },
                          { value: 'rental', label: intl.formatMessage({ id: 'income.categories.rental' }) },
                          { value: 'other', label: intl.formatMessage({ id: 'income.categories.other' }) }
                        ]}
                        onChange={(value) => handleEditChange(income.id, 'category', value)}
                        onBlur={() => handleBlur(income.id, 'category')}
                        onKeyDown={(e) => handleKeyDown(e, income.id, 'category')}
                        isEditing={true}
                      />
                    ) : (
                      <FormattedMessage id={`income.categories.${income.category}`} />
                    )}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap"
                    onDoubleClick={() => handleEdit(income.id, 'description')}
                  >
                    {editForm[income.id] ? (
                      <EditableCell
                        value={editForm[income.id].description}
                        onChange={(value) => handleEditChange(income.id, 'description', value)}
                        onBlur={() => handleBlur(income.id, 'description')}
                        onKeyDown={(e) => handleKeyDown(e, income.id, 'description')}
                        isEditing={true}
                        validation={validateDescription}
                      />
                    ) : (
                      income.description
                    )}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap"
                    onDoubleClick={() => handleEdit(income.id, 'amount')}
                  >
                    {editForm[income.id] ? (
                      <EditableCell
                        value={editForm[income.id].amount.toString()}
                        onChange={(value) => handleEditChange(income.id, 'amount', parseFloat(value))}
                        onBlur={() => handleBlur(income.id, 'amount')}
                        onKeyDown={(e) => handleKeyDown(e, income.id, 'amount')}
                        isEditing={true}
                        validation={validateAmount}
                        type="number"
                      />
                    ) : (
                      formatCurrency(income.amount)
                    )}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap"
                    onDoubleClick={() => handleEdit(income.id, 'date')}
                  >
                    {editForm[income.id] ? (
                      <EditableCell
                        value={editForm[income.id].date}
                        onChange={(value) => handleEditChange(income.id, 'date', value)}
                        onBlur={() => handleBlur(income.id, 'date')}
                        onKeyDown={(e) => handleKeyDown(e, income.id, 'date')}
                        isEditing={true}
                        validation={validateDate}
                        type="date"
                      />
                    ) : (
                      <FormattedDate value={new Date(income.date)} />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[income.id] ? (
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editForm[income.id].is_recurring}
                          onChange={(e) => handleEditChange(income.id, 'is_recurring', e.target.checked)}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                      </div>
                    ) : (
                      income.is_recurring ? (
                        <span className="text-green-600 dark:text-green-400">
                          <FormattedMessage id="common.yes" />
                        </span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">
                          <FormattedMessage id="common.no" />
                        </span>
                      )
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {editForm[income.id] ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSaveEdit(income.id); }}
                          className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                        >
                          <CheckIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCancelEdit(income.id); }}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Tooltip content={intl.formatMessage({ id: 'common.edit' })}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(income.id, 'all'); }}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                        </Tooltip>
                        <Tooltip content={intl.formatMessage({ id: 'common.delete' })}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(income.id); }}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </Tooltip>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 