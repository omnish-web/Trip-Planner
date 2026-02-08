-- MIGRATION: GUEST USER SUPPORT
-- Goal: Allow participants without a user_id (Guests) and link expenses to Participants instead of Users.

-- 1. Modify trip_participants
DO $$ 
BEGIN 
    -- Add ID if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_participants' AND column_name = 'id') THEN
        ALTER TABLE trip_participants DROP CONSTRAINT IF EXISTS trip_participants_pkey CASCADE;
        ALTER TABLE trip_participants ADD COLUMN id uuid DEFAULT uuid_generate_v4() PRIMARY KEY;
    END IF;

    -- Add Name if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_participants' AND column_name = 'name') THEN
        ALTER TABLE trip_participants ADD COLUMN name text;
    END IF;

    -- Make user_id nullable if it isn't already
    ALTER TABLE trip_participants ALTER COLUMN user_id DROP NOT NULL;
END $$;

-- Ensure a participant is either a user or a named guest
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_user_or_guest') THEN
        ALTER TABLE trip_participants ADD CONSTRAINT check_user_or_guest CHECK (user_id IS NOT NULL OR name IS NOT NULL);
    END IF;
END $$;

-- Maintain uniqueness for registered users
DROP INDEX IF EXISTS idx_trip_user;
CREATE UNIQUE INDEX idx_trip_user ON trip_participants(trip_id, user_id) WHERE user_id IS NOT NULL;


-- 2. Migrate EXPENSES
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'paid_by_participant_id') THEN
        ALTER TABLE expenses ADD COLUMN paid_by_participant_id uuid REFERENCES trip_participants(id);
    END IF;
END $$;

-- Data Migration: Link existing expenses (Safe to run multiple times)
UPDATE expenses e
SET paid_by_participant_id = tp.id
FROM trip_participants tp
WHERE e.trip_id = tp.trip_id AND e.paid_by = tp.user_id
AND e.paid_by_participant_id IS NULL; -- Only update if not already set

-- Switch columns (Handling the rename logic carefully)
DO $$
BEGIN
    -- If we have paid_by_participant_id and it is populated, we can drop the old paid_by and rename.
    -- However, if 'paid_by' is ALREADY the UUID column (from a previous run), we shouldn't do anything.
    -- We can check the type of 'paid_by'. If it's UUID, we are done. If it's text (user_id), we need to swap.
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'paid_by' AND data_type = 'text') THEN
         -- Drop old text column
         ALTER TABLE expenses DROP COLUMN paid_by CASCADE;
         -- Rename new UUID column to paid_by
         ALTER TABLE expenses RENAME COLUMN paid_by_participant_id TO paid_by;
    END IF;
END $$;


-- 3. Migrate EXPENSE SPLITS
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expense_splits' AND column_name = 'participant_id') THEN
        ALTER TABLE expense_splits ADD COLUMN participant_id uuid REFERENCES trip_participants(id);
    END IF;
END $$;

-- Data Migration
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expense_splits' AND column_name = 'user_id') THEN
        UPDATE expense_splits es
        SET participant_id = tp.id
        FROM expenses e
        JOIN trip_participants tp ON e.trip_id = tp.trip_id
        WHERE es.expense_id = e.id AND es.user_id = tp.user_id
        AND es.participant_id IS NULL;
    END IF;
END $$;

-- Drop old column and rename (Same logic as above)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expense_splits' AND column_name = 'user_id') THEN
         ALTER TABLE expense_splits DROP COLUMN user_id CASCADE;
    END IF;
    
    -- Rename if the new column exists (might have failed before rename check)
    -- If 'participant_id' exists, we leave it. The code expects 'participant_id'. 
    -- Wait, the previous script tried to rename 'participant_id' TO 'participant_id' which does nothing.
    -- But the code uses 'participant_id'. So we just ensure 'user_id' is gone and 'participant_id' is there.
END $$;


-- 4. Update Policies
-- (Policies can be dropped and recreated safely)

-- Helper function to prevent infinite recursion in policies
-- SECURITY DEFINER allows this function to bypass RLS when checking membership
CREATE OR REPLACE FUNCTION get_my_trip_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT trip_id FROM trip_participants WHERE user_id = auth.uid();
$$;

-- Trip Participants
DROP POLICY IF EXISTS "Participants viewable by trip members." ON trip_participants;
CREATE POLICY "Participants viewable by trip members." ON trip_participants FOR SELECT USING (
  trip_id IN ( SELECT get_my_trip_ids() )
);

DROP POLICY IF EXISTS "Allow adding guests." ON trip_participants;
CREATE POLICY "Allow adding guests." ON trip_participants FOR INSERT WITH CHECK (
  trip_id IN ( SELECT get_my_trip_ids() )
);

-- Expenses
DROP POLICY IF EXISTS "Expenses viewable by trip members." ON expenses;
CREATE POLICY "Expenses viewable by trip members." ON expenses FOR SELECT USING (
  trip_id IN ( SELECT get_my_trip_ids() )
);

DROP POLICY IF EXISTS "Expenses insertable by trip members." ON expenses;
CREATE POLICY "Expenses insertable by trip members." ON expenses FOR INSERT WITH CHECK (
  trip_id IN ( SELECT get_my_trip_ids() )
);

-- Splits
DROP POLICY IF EXISTS "Splits viewable by trip members." ON expense_splits;
CREATE POLICY "Splits viewable by trip members." ON expense_splits FOR SELECT USING (
  expense_id IN (
      SELECT id FROM expenses WHERE trip_id IN ( SELECT get_my_trip_ids() )
  )
);

DROP POLICY IF EXISTS "Splits insertable by trip members." ON expense_splits;
CREATE POLICY "Splits insertable by trip members." ON expense_splits FOR INSERT WITH CHECK (
  expense_id IN (
      SELECT id FROM expenses WHERE trip_id IN ( SELECT get_my_trip_ids() )
  )
);
