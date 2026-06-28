-- Hard reset of foreign keys for expense_splits and expense_payers
-- This dynamically finds ANY constraint pointing to the expenses table and drops it,
-- then recreates a fresh ON DELETE CASCADE constraint.

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- 1. Drop all foreign keys on expense_splits that reference expenses
    FOR r IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'expense_splits'::regclass 
        AND confrelid = 'expenses'::regclass
    LOOP
        EXECUTE 'ALTER TABLE expense_splits DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;

    -- 2. Drop all foreign keys on expense_payers that reference expenses
    FOR r IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'expense_payers'::regclass 
        AND confrelid = 'expenses'::regclass
    LOOP
        EXECUTE 'ALTER TABLE expense_payers DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;

    -- 3. Add fresh ON DELETE CASCADE constraints
    ALTER TABLE expense_splits 
    ADD CONSTRAINT expense_splits_expense_id_fkey 
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE;
    
    ALTER TABLE expense_payers 
    ADD CONSTRAINT expense_payers_expense_id_fkey 
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE;

EXCEPTION
    WHEN undefined_table THEN
        -- Handle case where expense_payers doesn't exist yet
        NULL;
END $$;
