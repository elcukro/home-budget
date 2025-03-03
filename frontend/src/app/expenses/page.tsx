'use client';

import { useState, useEffect } from 'react';
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { validateAmount, validateDescription, validateDate } from '@/utils/validation';
import Tooltip from '@/components/Tooltip';

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

const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

const formatPercentage = (rate: number | null | undefined): string => {
  if (rate === null || rate === undefined) return '0%';
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rate / 100);
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [formData, setFormData] = useState<ExpenseFormData>({
    category: '',
    description: '',
    amount: 0,
    is_recurring: false,
    date: new Date().toISOString().split('T')[0],
  });
  const [editForm, setEditForm] = useState<{ [key: number]: ExpenseFormData }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const response = await fetch('http://localhost:8000/users/1/expenses/');
      if (!response.ok) {
        throw new Error('Failed to fetch expenses');
      }
      const data = await response.json();
      setExpenses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:8000/users/1/expenses/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to add expense');
      }

      const newExpense = await response.json();
      setExpenses([...expenses, newExpense]);
      
      // Reset form
      setFormData({
        category: '',
        description: '',
        amount: 0,
        is_recurring: false,
        date: new Date().toISOString().split('T')[0],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add expense');
    }
  };

  const handleEdit = (expense: Expense) => {
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
    const response = await fetch(`http://localhost:8000/users/1/expenses/${expenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm[expenseId]),
    });
    if (response.ok) {
      const newEditForm = { ...editForm };
      delete newEditForm[expenseId];
      setEditForm(newEditForm);
      fetchExpenses();
    }
  };

  const handleDelete = async (expenseId: number) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    
    const response = await fetch(`http://localhost:8000/users/1/expenses/${expenseId}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      fetchExpenses();
    }
  };

  if (loading) {
    return <div className="text-center">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Expense Management</h1>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md">
          {error}
        </div>
      )}

      {/* Add Expense Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium mb-4">Add New Expense</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">
              Category
              <Tooltip content="Select the category that best describes your expense" />
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            >
              <option value="">Select a category</option>
              <option value="housing">Housing</option>
              <option value="transportation">Transportation</option>
              <option value="food">Food</option>
              <option value="utilities">Utilities</option>
              <option value="insurance">Insurance</option>
              <option value="healthcare">Healthcare</option>
              <option value="entertainment">Entertainment</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
              <Tooltip content="Enter a brief description of the expense (e.g., Grocery shopping at Walmart)" />
            </label>
            <input
              type="text"
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Amount
              <Tooltip content="Enter the expense amount in dollars (e.g., 50.99 for $50.99)" />
            </label>
            <input
              type="number"
              id="amount"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
              min="0"
              step="0.01"
            />
          </div>
          
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700">
              Date
              <Tooltip content="Select the date when the expense occurred" />
            </label>
            <input
              type="date"
              id="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              Recurring Monthly Expense
              <Tooltip content="Check this if this expense occurs regularly each month (e.g., rent, utilities)" />
            </label>
          </div>
          
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Add Expense
          </button>
        </form>
      </div>

      {/* Expense List */}
      <div className="bg-white p-6 rounded-lg shadow overflow-hidden">
        <h2 className="text-lg font-medium mb-4">Expense History</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recurring</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-t">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[expense.id] ? (
                      <select
                        value={editForm[expense.id].category}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          [expense.id]: { ...editForm[expense.id], category: e.target.value }
                        })}
                        className="border p-1 rounded w-full"
                      >
                        <option value="housing">Housing</option>
                        <option value="transportation">Transportation</option>
                        <option value="food">Food</option>
                        <option value="utilities">Utilities</option>
                        <option value="insurance">Insurance</option>
                        <option value="healthcare">Healthcare</option>
                        <option value="entertainment">Entertainment</option>
                        <option value="other">Other</option>
                      </select>
                    ) : (
                      expense.category.charAt(0).toUpperCase() + expense.category.slice(1)
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[expense.id] ? (
                      <input
                        type="text"
                        value={editForm[expense.id].description}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          [expense.id]: { ...editForm[expense.id], description: e.target.value }
                        })}
                        className="border p-1 rounded w-full"
                      />
                    ) : (
                      expense.description
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[expense.id] ? (
                      <input
                        type="number"
                        value={editForm[expense.id].amount}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          [expense.id]: { ...editForm[expense.id], amount: Number(e.target.value) }
                        })}
                        className="border p-1 rounded w-full"
                      />
                    ) : (
                      formatCurrency(expense.amount)
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[expense.id] ? (
                      <input
                        type="date"
                        value={editForm[expense.id].date}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          [expense.id]: { ...editForm[expense.id], date: e.target.value }
                        })}
                        className="border p-1 rounded w-full"
                      />
                    ) : (
                      new Date(expense.date).toLocaleDateString()
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[expense.id] ? (
                      <input
                        type="checkbox"
                        checked={editForm[expense.id].is_recurring}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          [expense.id]: { ...editForm[expense.id], is_recurring: e.target.checked }
                        })}
                      />
                    ) : (
                      expense.is_recurring ? 'Yes' : 'No'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[expense.id] ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleSaveEdit(expense.id)}
                          className="text-green-600 hover:text-green-800"
                        >
                          <CheckIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleCancelEdit(expense.id)}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="text-red-600 hover:text-red-800"
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
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    No expense entries yet
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