-- Cleanup Script: Remove duplicate bank transactions and expenses
-- Run this AFTER deploying the provider_transaction_id fix
-- Safe to run multiple times (idempotent)

BEGIN;

-- Step 1: Find duplicate bank_transaction IDs (to be deleted)
CREATE TEMP TABLE duplicates_to_delete AS
WITH duplicates AS (
    SELECT
        id,
        provider_transaction_id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, provider_transaction_id
            ORDER BY id ASC  -- Keep oldest
        ) as row_num
    FROM bank_transactions
    WHERE provider_transaction_id IS NOT NULL
)
SELECT id FROM duplicates WHERE row_num > 1;

-- Step 2: Clear linked_expense_id and linked_income_id references
-- (Break circular foreign key dependencies)
UPDATE bank_transactions
SET linked_expense_id = NULL
WHERE id IN (SELECT id FROM duplicates_to_delete);

UPDATE bank_transactions
SET linked_income_id = NULL
WHERE id IN (SELECT id FROM duplicates_to_delete);

-- Step 3: Delete expense records linked to duplicate bank_transactions
DELETE FROM expenses
WHERE bank_transaction_id IN (SELECT id FROM duplicates_to_delete);

-- Step 4: Delete income records linked to duplicate bank_transactions
DELETE FROM income
WHERE bank_transaction_id IN (SELECT id FROM duplicates_to_delete);

-- Step 5: Now safe to delete the duplicate bank_transactions
DELETE FROM bank_transactions
WHERE id IN (SELECT id FROM duplicates_to_delete);

-- Show summary of what was deleted
SELECT
    'Duplicates cleaned up successfully' as status,
    (SELECT COUNT(*) FROM bank_transactions) as remaining_bank_transactions,
    (SELECT COUNT(*) FROM expenses WHERE bank_transaction_id IS NOT NULL) as bank_linked_expenses,
    (SELECT COUNT(*) FROM income WHERE bank_transaction_id IS NOT NULL) as bank_linked_income;

COMMIT;
