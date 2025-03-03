'use client';

import { useState, useEffect } from 'react';
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
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

interface Loan {
  id: number;
  description: string;
  amount: number;
  interest_rate: number;
  monthly_payment: number;
  start_date: string;
  end_date: string;
  created_at: string;
}

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
  user_id: number;
  created_at: string;
}

const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

const formatPercentage = (rate: number): string => {
  return `${rate.toFixed(2)}%`;
};

export default function LoansPage() {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLoans();
  }, []);

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

  const fetchLoans = async () => {
    try {
      const response = await fetch('http://localhost:8000/users/1/loans/');
      if (!response.ok) throw new Error('Failed to fetch loans');
      const data = await response.json();
      setLoans(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load loans';
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

    const promise = fetch('http://localhost:8000/users/1/loans/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    }).then(async (response) => {
      if (!response.ok) throw new Error('Failed to add loan');
      const newLoan = await response.json();
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
    });

    toast.promise(promise, {
      loading: 'Adding loan...',
      success: 'Loan added successfully',
      error: 'Failed to add loan',
    });
  };

  const handleEdit = (loan: Loan) => {
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
    const newEditForm = { ...editForm };
    delete newEditForm[loanId];
    setEditForm(newEditForm);
  };

  const handleSaveEdit = async (loanId: number) => {
    const data = editForm[loanId];
    
    const validationError = validateForm(data);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const promise = fetch(`http://localhost:8000/users/1/loans/${loanId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(async (response) => {
      if (!response.ok) throw new Error('Failed to update loan');
      const newEditForm = { ...editForm };
      delete newEditForm[loanId];
      setEditForm(newEditForm);
      await fetchLoans();
    });

    toast.promise(promise, {
      loading: 'Updating loan...',
      success: 'Loan updated successfully',
      error: 'Failed to update loan',
    });
  };

  const handleDelete = async (loanId: number) => {
    if (!confirm('Are you sure you want to delete this loan?')) return;
    
    const promise = fetch(`http://localhost:8000/users/1/loans/${loanId}`, {
      method: 'DELETE',
    }).then(async (response) => {
      if (!response.ok) throw new Error('Failed to delete loan');
      await fetchLoans();
    });

    toast.promise(promise, {
      loading: 'Deleting loan...',
      success: 'Loan deleted successfully',
      error: 'Failed to delete loan',
    });
  };

  if (loading) {
    return <div className="text-center">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Loan Management</h1>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md">
          {error}
        </div>
      )}

      {/* Add Loan Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium mb-4">Add New Loan</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="loan_type" className="block text-sm font-medium text-gray-700 mb-1">
                Loan Type
                <Tooltip content="Select the type of loan (e.g., Mortgage, Car Loan, Personal Loan)" />
              </label>
              <select
                id="loan_type"
                value={formData.loan_type}
                onChange={(e) => setFormData({ ...formData, loan_type: e.target.value })}
                className="border p-2 rounded w-full"
                required
              >
                <option value="">Select a type</option>
                <option value="mortgage">Mortgage</option>
                <option value="car">Car Loan</option>
                <option value="personal">Personal Loan</option>
                <option value="student">Student Loan</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
                <Tooltip content="Enter a brief description of the loan (e.g., Home mortgage with Bank XYZ)" />
              </label>
              <input
                type="text"
                id="description"
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="border p-2 rounded w-full"
                required
              />
            </div>
            
            <div>
              <label htmlFor="principal_amount" className="block text-sm font-medium text-gray-700 mb-1">
                Principal Amount
                <Tooltip content="Enter the original loan amount borrowed" />
              </label>
              <input
                type="number"
                id="principal_amount"
                placeholder="Principal Amount"
                value={formData.principal_amount}
                onChange={(e) => setFormData({ ...formData, principal_amount: Number(e.target.value) })}
                className="border p-2 rounded w-full"
                required
                min="0"
                step="0.01"
              />
            </div>
            
            <div>
              <label htmlFor="remaining_balance" className="block text-sm font-medium text-gray-700 mb-1">
                Remaining Balance
                <Tooltip content="Enter the current outstanding balance of the loan" />
              </label>
              <input
                type="number"
                id="remaining_balance"
                placeholder="Remaining Balance"
                value={formData.remaining_balance}
                onChange={(e) => setFormData({ ...formData, remaining_balance: Number(e.target.value) })}
                className="border p-2 rounded w-full"
                required
                min="0"
                max={formData.principal_amount}
                step="0.01"
              />
            </div>
            
            <div>
              <label htmlFor="interest_rate" className="block text-sm font-medium text-gray-700 mb-1">
                Interest Rate (%)
                <Tooltip content="Enter the annual interest rate (e.g., 5.25 for 5.25%)" />
              </label>
              <input
                type="number"
                id="interest_rate"
                placeholder="Interest Rate (%)"
                value={formData.interest_rate}
                onChange={(e) => setFormData({ ...formData, interest_rate: Number(e.target.value) })}
                className="border p-2 rounded w-full"
                required
                min="0"
                max="100"
                step="0.01"
              />
            </div>
            
            <div>
              <label htmlFor="monthly_payment" className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Payment
                <Tooltip content="Enter your fixed monthly payment amount" />
              </label>
              <input
                type="number"
                id="monthly_payment"
                placeholder="Monthly Payment"
                value={formData.monthly_payment}
                onChange={(e) => setFormData({ ...formData, monthly_payment: Number(e.target.value) })}
                className="border p-2 rounded w-full"
                required
                min="0"
                step="0.01"
              />
            </div>
            
            <div>
              <label htmlFor="term_months" className="block text-sm font-medium text-gray-700 mb-1">
                Term (Months)
                <Tooltip content="Enter the total duration of the loan in months (e.g., 360 for a 30-year mortgage)" />
              </label>
              <input
                type="number"
                id="term_months"
                placeholder="Loan Term in Months"
                value={formData.term_months}
                onChange={(e) => setFormData({ ...formData, term_months: Number(e.target.value) })}
                className="border p-2 rounded w-full"
                required
                min="1"
                step="1"
              />
            </div>
            
            <div>
              <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
                <Tooltip content="Select the date when the loan began" />
              </label>
              <input
                type="date"
                id="start_date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="border p-2 rounded w-full"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Add Loan
          </button>
        </form>
      </div>

      {/* Loans List */}
      <div className="bg-white p-6 rounded-lg shadow overflow-hidden">
        <h2 className="text-lg font-medium mb-4">Loan History</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Principal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Payment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Term (Months)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loans.map((loan) => (
                <tr key={loan.id} className="border-t">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[loan.id] ? (
                      <select
                        value={editForm[loan.id].loan_type}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          [loan.id]: { ...editForm[loan.id], loan_type: e.target.value }
                        })}
                        className="border p-1 rounded w-full"
                      >
                        <option value="mortgage">Mortgage</option>
                        <option value="car">Car Loan</option>
                        <option value="personal">Personal Loan</option>
                        <option value="student">Student Loan</option>
                        <option value="other">Other</option>
                      </select>
                    ) : (
                      loan.loan_type.charAt(0).toUpperCase() + loan.loan_type.slice(1)
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[loan.id] ? (
                      <input
                        type="text"
                        value={editForm[loan.id].description}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          [loan.id]: { ...editForm[loan.id], description: e.target.value }
                        })}
                        className="border p-1 rounded w-full"
                      />
                    ) : (
                      loan.description
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[loan.id] ? (
                      <input
                        type="number"
                        value={editForm[loan.id].principal_amount}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          [loan.id]: { ...editForm[loan.id], principal_amount: Number(e.target.value) }
                        })}
                        className="border p-1 rounded w-full"
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      formatCurrency(loan.principal_amount)
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[loan.id] ? (
                      <input
                        type="number"
                        value={editForm[loan.id].remaining_balance}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          [loan.id]: { ...editForm[loan.id], remaining_balance: Number(e.target.value) }
                        })}
                        className="border p-1 rounded w-full"
                        min="0"
                        max={editForm[loan.id].principal_amount}
                        step="0.01"
                      />
                    ) : (
                      formatCurrency(loan.remaining_balance)
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[loan.id] ? (
                      <input
                        type="number"
                        value={editForm[loan.id].interest_rate}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          [loan.id]: { ...editForm[loan.id], interest_rate: Number(e.target.value) }
                        })}
                        className="border p-1 rounded w-full"
                        min="0"
                        max="100"
                        step="0.01"
                      />
                    ) : (
                      formatPercentage(loan.interest_rate)
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[loan.id] ? (
                      <input
                        type="number"
                        value={editForm[loan.id].monthly_payment}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          [loan.id]: { ...editForm[loan.id], monthly_payment: Number(e.target.value) }
                        })}
                        className="border p-1 rounded w-full"
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      formatCurrency(loan.monthly_payment)
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[loan.id] ? (
                      <input
                        type="number"
                        value={editForm[loan.id].term_months}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          [loan.id]: { ...editForm[loan.id], term_months: Number(e.target.value) }
                        })}
                        className="border p-1 rounded w-full"
                        min="1"
                        step="1"
                      />
                    ) : (
                      loan.term_months
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[loan.id] ? (
                      <input
                        type="date"
                        value={editForm[loan.id].start_date}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          [loan.id]: { ...editForm[loan.id], start_date: e.target.value }
                        })}
                        className="border p-1 rounded w-full"
                      />
                    ) : (
                      new Date(loan.start_date).toLocaleDateString()
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editForm[loan.id] ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleSaveEdit(loan.id)}
                          className="text-green-600 hover:text-green-800"
                        >
                          <CheckIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleCancelEdit(loan.id)}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(loan)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(loan.id)}
                          className="text-red-600 hover:text-red-800"
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
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    No loan entries yet
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