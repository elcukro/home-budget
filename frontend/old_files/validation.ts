export const validateAmount = (amount: number): string | null => {
  if (amount < 0) return "Amount cannot be negative";
  if (amount > 1000000000) return "Amount is too large";
  return null;
};

export const validateDescription = (description: string): string | null => {
  if (!description.trim()) return "Description is required";
  if (description.length > 100) return "Description is too long (max 100 characters)";
  return null;
};

export const validateDate = (date: string): string | null => {
  const selectedDate = new Date(date);
  const now = new Date();
  if (selectedDate > now) return "Date cannot be in the future";
  if (selectedDate.getFullYear() < 2000) return "Date cannot be before year 2000";
  return null;
};

export const validateInterestRate = (rate: number): string | null => {
  if (rate < 0) return "Interest rate cannot be negative";
  if (rate > 100) return "Interest rate cannot exceed 100%";
  return null;
};

export const validateMonthlyPayment = (payment: number, amount: number): string | null => {
  if (payment < 0) return "Monthly payment cannot be negative";
  if (payment > amount) return "Monthly payment cannot exceed loan amount";
  return null;
};

export const validateRemainingBalance = (balance: number, amount: number): string | null => {
  if (balance < 0) return "Remaining balance cannot be negative";
  if (balance > amount) return "Remaining balance cannot exceed loan amount";
  return null;
}; 