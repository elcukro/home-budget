'use client';

import { useState, useEffect } from 'react';
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { validateAmount, validateDescription, validateDate } from '@/utils/validation';
import Tooltip from '@/components/Tooltip';

const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

interface IncomeFormData {
  source: string;
  amount: number;
  is_recurring: boolean;
  date: string;
}

interface Income extends IncomeFormData {
  id: number;
}

export default function IncomePage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [formData, setFormData] = useState<IncomeFormData>({
    source: '',
    amount: 0,
    is_recurring: false,
    date: new Date().toISOString().split('T')[0],
  });
  const [editForm, setEditForm] = useState<{ [key: number]: IncomeFormData }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIncomes();
  }, []);

  const validateForm = (data: IncomeFormData): string | null => {
    const sourceError = validateDescription(data.source);
    if (sourceError) return sourceError;

    const amountError = validateAmount(data.amount);
    if (amountError) return amountError;

    const dateError = validateDate(data.date);
    if (dateError) return dateError;

    return null;
  };

  const fetchIncomes = async () => {
    try {
      const response = await fetch('http://localhost:8000/users/1/incomes/');
      if (!response.ok) throw new Error('Failed to fetch incomes');
      const data = await response.json();
      setIncomes(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load incomes';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm(formData);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const promise = fetch('http://localhost:8000/users/1/incomes/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    }).then(async (response) => {
      if (!response.ok) throw new Error('Failed to add income');
      const newIncome = await response.json();
      setIncomes([...incomes, newIncome]);
      setFormData({
        source: '',
        amount: 0,
        is_recurring: false,
        date: new Date().toISOString().split('T')[0],
      });
    });

    toast.promise(promise, {
      loading: 'Adding income...',
      success: 'Income added successfully',
      error: 'Failed to add income',
    });
  };

  const handleEdit = (income: Income) => {
    setEditForm({
      ...editForm,
      [income.id]: {
        source: income.source,
        amount: income.amount,
        date: income.date,
        is_recurring: income.is_recurring,
      },
    });
  };

  const handleCancelEdit = (incomeId: number) => {
    const newEditForm = { ...editForm };
    delete newEditForm[incomeId];
    setEditForm(newEditForm);
  };

  const handleSaveEdit = async (incomeId: number) => {
    const data = editForm[incomeId];
    
    const validationError = validateForm(data);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const promise = fetch(`http://localhost:8000/users/1/incomes/${incomeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(async (response) => {
      if (!response.ok) throw new Error('Failed to update income');
      const newEditForm = { ...editForm };
      delete newEditForm[incomeId];
      setEditForm(newEditForm);
      await fetchIncomes();
    });

    toast.promise(promise, {
      loading: 'Updating income...',
      success: 'Income updated successfully',
      error: 'Failed to update income',
    });
  };

  const handleDelete = async (incomeId: number) => {
    if (!confirm('Are you sure you want to delete this income?')) return;
    
    const promise = fetch(`http://localhost:8000/users/1/incomes/${incomeId}`, {
      method: 'DELETE',
    }).then(async (response) => {
      if (!response.ok) throw new Error('Failed to delete income');
      await fetchIncomes();
    });

    toast.promise(promise, {
      loading: 'Deleting income...',
      success: 'Income deleted successfully',
      error: 'Failed to delete income',
    });
  };

  if (loading) {
    return <div className="text-center">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-default">Income Management</h1>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-md">
          {error}
        </div>
      )}

      {/* Add Income Form */}
      <div className="card p-6">
        <h2 className="text-lg font-medium mb-4 text-default">Add New Income</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="source" className="block text-sm font-medium text-secondary mb-1">
                Source
                <Tooltip content="Enter the source of your income (e.g., Salary, Freelance, Investment)" />
              </label>
              <input
                type="text"
                id="source"
                placeholder="Income source"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full rounded-md border p-2"
                required
              />
            </div>
            
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-secondary mb-1">
                Amount
                <Tooltip content="Enter the amount in dollars (e.g., 5000 for $5,000.00)" />
              </label>
              <input
                type="number"
                id="amount"
                placeholder="Amount"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className="w-full rounded-md border p-2"
                required
                min="0"
                step="0.01"
              />
            </div>
            
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-secondary mb-1">
                Date
                <Tooltip content="Select the date when you received or expect to receive this income" />
              </label>
              <input
                type="date"
                id="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full rounded-md border p-2"
                required
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_recurring"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="is_recurring" className="ml-2 block text-sm text-secondary">
                Recurring Monthly Income
                <Tooltip content="Check this if you receive this income regularly each month (e.g., salary)" />
              </label>
            </div>
          </div>
          
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Add Income
          </button>
        </form>
      </div>

      {/* Income List */}
      <div className="card overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-medium mb-4 text-default">Income History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Source</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Amount</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Recurring</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {incomes.map((income) => (
                <tr key={income.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[income.id] ? (
                      <input
                        type="text"
                        value={editForm[income.id].source}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          [income.id]: { ...editForm[income.id], source: e.target.value }
                        })}
                        className="w-full rounded-md border p-1"
                      />
                    ) : (
                      income.source
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[income.id] ? (
                      <input
                        type="number"
                        value={editForm[income.id].amount}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          [income.id]: { ...editForm[income.id], amount: Number(e.target.value) }
                        })}
                        className="w-full rounded-md border p-1"
                      />
                    ) : (
                      formatCurrency(income.amount)
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[income.id] ? (
                      <input
                        type="date"
                        value={editForm[income.id].date}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          [income.id]: { ...editForm[income.id], date: e.target.value }
                        })}
                        className="w-full rounded-md border p-1"
                      />
                    ) : (
                      new Date(income.date).toLocaleDateString()
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[income.id] ? (
                      <input
                        type="checkbox"
                        checked={editForm[income.id].is_recurring}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          [income.id]: { ...editForm[income.id], is_recurring: e.target.checked }
                        })}
                      />
                    ) : (
                      income.is_recurring ? 'Yes' : 'No'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[income.id] ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleSaveEdit(income.id)}
                          className="text-green-600 hover:text-green-800"
                        >
                          <CheckIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleCancelEdit(income.id)}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(income)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(income.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {incomes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-secondary">
                    No income entries yet
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