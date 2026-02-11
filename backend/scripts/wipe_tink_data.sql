-- Wipe all Tink data for fresh start
-- WARNING: This deletes ALL bank transactions and linked expenses/income!

BEGIN;

-- Step 1: Clear foreign key references
UPDATE bank_transactions SET linked_expense_id = NULL WHERE linked_expense_id IS NOT NULL;
UPDATE bank_transactions SET linked_income_id = NULL WHERE linked_income_id IS NOT NULL;

-- Step 2: Delete all expenses created from bank transactions
DELETE FROM expenses WHERE bank_transaction_id IS NOT NULL;

-- Step 3: Delete all income created from bank transactions
DELETE FROM income WHERE bank_transaction_id IS NOT NULL;

-- Step 4: Delete all bank transactions
DELETE FROM bank_transactions;

-- Step 5: Show summary
SELECT
    'Tink data wiped successfully' as status,
    (SELECT COUNT(*) FROM bank_transactions) as remaining_bank_transactions,
    (SELECT COUNT(*) FROM expenses WHERE bank_transaction_id IS NOT NULL) as bank_linked_expenses,
    (SELECT COUNT(*) FROM income WHERE bank_transaction_id IS NOT NULL) as bank_linked_income;

COMMIT;
