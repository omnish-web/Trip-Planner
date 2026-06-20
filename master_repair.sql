-- MASTER REPAIR SCRIPT v2
-- Goal: Fix Data Integrity (User IDs in UUID columns), Constraint Violations, and Infinite Recursion.
-- Run this ENTIRE script in Supabase SQL Editor.

BEGIN;

--------------------------------------------------------------------------------
-- 1. DATA CLEANUP (Fix "Violates Foreign Key" error)
--------------------------------------------------------------------------------

-- A. Fix EXPENSES: 'paid_by' might still hold user_ids (UUIDs) instead of participant_ids.
-- We update them by finding the matching participant in the same trip.
UPDATE expenses e
SET paid_by = tp.id
FROM trip_participants tp
WHERE e.trip_id = tp.trip_id 
  AND e.paid_by::text = tp.user_id::text -- Compare as text to avoid type mismatch
  AND e.paid_by::text != tp.id::text;    -- Only update if different

-- B. Fix EXPENSE SPLITS: Same issue for 'participant_id' (or 'user_id' if it exists)
-- If 'user_id' column still exists, ensure we migrate from it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expense_splits' AND column_name = 'user_id') THEN
        UPDATE expense_splits es
        SET participant_id = tp.id
        FROM trip_participants tp, expenses e
        WHERE es.expense_id = e.id 
          AND e.trip_id = tp.trip_id
          AND es.user_id = tp.user_id
          AND es.participant_id IS NULL;
    END IF;
END $$;

-- C. DELETE ORPHANS
-- If there are still expenses where 'paid_by' does NOT match a participant, we must delete them.
-- (These are likely from users who were deleted or test data).
DELETE FROM expense_splits
WHERE participant_id NOT IN (SELECT id FROM trip_participants);

DELETE FROM expenses
WHERE paid_by NOT IN (SELECT id FROM trip_participants);


--------------------------------------------------------------------------------
-- 2. SCHEMA & CONSTRAINTS
--------------------------------------------------------------------------------

-- A. EXPENSES Foreign Key
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_paid_by_fkey;
ALTER TABLE expenses ADD CONSTRAINT expenses_paid_by_fkey 
    FOREIGN KEY (paid_by) REFERENCES trip_participants(id) ON DELETE CASCADE;

-- B. SPLITS Foreign Key
ALTER TABLE expense_splits DROP CONSTRAINT IF EXISTS expense_splits_participant_id_fkey;
ALTER TABLE expense_splits ADD CONSTRAINT expense_splits_participant_id_fkey 
    FOREIGN KEY (participant_id) REFERENCES trip_participants(id) ON DELETE CASCADE;

-- C. Cleanup old columns if they exist
DO $$ BEGIN
    ALTER TABLE expense_splits DROP COLUMN IF EXISTS user_id;
EXCEPTION WHEN OTHERS THEN NULL; END $$;


--------------------------------------------------------------------------------
-- 3. FIX POLICIES (Fix "Infinite Recursion" error)
--------------------------------------------------------------------------------

-- A. Helper Function (SECURITY DEFINER to break recursion)
CREATE OR REPLACE FUNCTION get_my_trip_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT trip_id FROM trip_participants WHERE user_id = auth.uid();
$$;

-- B. Reset Policies

-- Trip Participants
DROP POLICY IF EXISTS "Participants viewable by trip members." ON trip_participants;
DROP POLICY IF EXISTS "Allow adding guests." ON trip_participants;
DROP POLICY IF EXISTS "Select_Participants" ON trip_participants;
DROP POLICY IF EXISTS "Insert_Guests" ON trip_participants;

CREATE POLICY "access_participants" ON trip_participants FOR SELECT USING (
  trip_id IN ( SELECT get_my_trip_ids() )
);
CREATE POLICY "insert_participants" ON trip_participants FOR INSERT WITH CHECK (
  trip_id IN ( SELECT get_my_trip_ids() )
);

-- Expenses
DROP POLICY IF EXISTS "Expenses viewable by trip members." ON expenses;
DROP POLICY IF EXISTS "Expenses insertable by trip members." ON expenses;
DROP POLICY IF EXISTS "Select_Expenses" ON expenses;
DROP POLICY IF EXISTS "Insert_Expenses" ON expenses;
DROP POLICY IF EXISTS "Delete_Expenses" ON expenses;

CREATE POLICY "access_expenses" ON expenses FOR SELECT USING (
  trip_id IN ( SELECT get_my_trip_ids() )
);
CREATE POLICY "insert_expenses" ON expenses FOR INSERT WITH CHECK (
  trip_id IN ( SELECT get_my_trip_ids() )
);
CREATE POLICY "delete_expenses" ON expenses FOR DELETE USING (
  trip_id IN ( SELECT get_my_trip_ids() )
);

-- Splits
DROP POLICY IF EXISTS "Splits viewable by trip members." ON expense_splits;
DROP POLICY IF EXISTS "Splits insertable by trip members." ON expense_splits;
DROP POLICY IF EXISTS "Select_Splits" ON expense_splits;
DROP POLICY IF EXISTS "Insert_Splits" ON expense_splits;

CREATE POLICY "access_splits" ON expense_splits FOR SELECT USING (
  expense_id IN ( SELECT id FROM expenses WHERE trip_id IN (SELECT get_my_trip_ids()) )
);
CREATE POLICY "insert_splits" ON expense_splits FOR INSERT WITH CHECK (
  expense_id IN ( SELECT id FROM expenses WHERE trip_id IN (SELECT get_my_trip_ids()) )
);

COMMIT;
