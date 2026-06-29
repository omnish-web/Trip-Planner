-- Fix Realtime Replication Error on expense_splits and expense_payers
-- When a table is added to a Supabase publication (realtime), PostgreSQL requires
-- a way to uniquely identify rows when they are deleted or updated. 
-- Since we migrated from user_id to participant_id, the old Primary Keys were lost.

BEGIN;

-- 1. Attempt to add Primary Keys (Best Practice)
DO $$
BEGIN
    -- Drop any existing primary keys just in case
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE contype = 'p' AND conrelid = 'expense_splits'::regclass
    ) THEN
        ALTER TABLE expense_splits DROP CONSTRAINT IF EXISTS expense_splits_pkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE contype = 'p' AND conrelid = 'expense_payers'::regclass
    ) THEN
        ALTER TABLE expense_payers DROP CONSTRAINT IF EXISTS expense_payers_pkey;
    END IF;

    -- Add the correct composite primary keys
    ALTER TABLE expense_splits ADD PRIMARY KEY (expense_id, participant_id);
    ALTER TABLE expense_payers ADD PRIMARY KEY (expense_id, participant_id);

EXCEPTION
    WHEN unique_violation THEN
        -- If there are duplicates, fallback to REPLICA IDENTITY FULL
        -- which tells Postgres to use the entire row as the identity for realtime.
        ALTER TABLE expense_splits REPLICA IDENTITY FULL;
        ALTER TABLE expense_payers REPLICA IDENTITY FULL;
    WHEN others THEN
        -- Fallback for any other constraint errors
        ALTER TABLE expense_splits REPLICA IDENTITY FULL;
        ALTER TABLE expense_payers REPLICA IDENTITY FULL;
END $$;

COMMIT;
