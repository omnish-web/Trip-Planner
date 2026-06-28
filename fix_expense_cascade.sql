-- Fix Foreign Key constraints for expense tables to ensure cascading deletes
-- If ON DELETE CASCADE is missing, deleting an expense will fail with a foreign key violation.

DO $$ 
BEGIN
    -- Fix expense_splits constraint
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'expense_splits_expense_id_fkey') THEN
        ALTER TABLE expense_splits DROP CONSTRAINT expense_splits_expense_id_fkey;
    END IF;
    
    ALTER TABLE expense_splits 
    ADD CONSTRAINT expense_splits_expense_id_fkey 
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE;
    
    -- Fix expense_payers constraint
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'expense_payers_expense_id_fkey') THEN
        ALTER TABLE expense_payers DROP CONSTRAINT expense_payers_expense_id_fkey;
    END IF;
    
    ALTER TABLE expense_payers 
    ADD CONSTRAINT expense_payers_expense_id_fkey 
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE;

EXCEPTION
    WHEN undefined_table THEN
        -- Handle case where expense_payers doesn't exist yet
        NULL;
END $$;
