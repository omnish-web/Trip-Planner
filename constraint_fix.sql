-- FINAL CONSTRAINT FIX
-- The previous error happened because we tried to change the data ('paid_by' -> participant_id) 
-- while the database was still checking if 'paid_by' existed in the 'profiles' table.
-- We must DROP the check first, THEN change the data.

BEGIN;

-- 1. DROP EXISTING CONSTRAINTS (So we can change the data)
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_paid_by_fkey;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_paid_by_participant_id_fkey;
ALTER TABLE expense_splits DROP CONSTRAINT IF EXISTS expense_splits_user_id_fkey;
ALTER TABLE expense_splits DROP CONSTRAINT IF EXISTS expense_splits_participant_id_fkey;


-- 2. MIGRATE DATA (Convert User IDs to Participant IDs)

-- Fix Expenses
UPDATE expenses e
SET paid_by = tp.id
FROM trip_participants tp
WHERE e.trip_id = tp.trip_id 
  AND e.paid_by::text = tp.user_id::text
  AND e.paid_by::text != tp.id::text; -- Only update if not already converted

-- Fix Expense Splits
-- (Handle case where column might be user_id or already participant_id but with old data)
DO $$
BEGIN
    -- If we still have user_id column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expense_splits' AND column_name = 'user_id') THEN
        UPDATE expense_splits es
        SET participant_id = tp.id
        FROM trip_participants tp, expenses e
        WHERE es.expense_id = e.id 
          AND e.trip_id = tp.trip_id
          AND es.user_id = tp.user_id;
    END IF;
END $$;


-- 3. CLEANUP ORPHANS (Data that cannot be migrated)
-- If we can't find a participant for the expense payer, we must delete the expense 
-- (or it will fail the new constraint).
DELETE FROM expense_splits WHERE participant_id IS NULL;
DELETE FROM expenses WHERE paid_by NOT IN (SELECT id FROM trip_participants);


-- 4. ADD NEW CONSTRAINTS (Now pointing to trip_participants)
ALTER TABLE expenses ADD CONSTRAINT expenses_paid_by_fkey 
    FOREIGN KEY (paid_by) REFERENCES trip_participants(id) ON DELETE CASCADE;

ALTER TABLE expense_splits ADD CONSTRAINT expense_splits_participant_id_fkey 
    FOREIGN KEY (participant_id) REFERENCES trip_participants(id) ON DELETE CASCADE;


-- 5. ENSURE POLICIES ARE CORRECT (Recursion Fix)
CREATE OR REPLACE FUNCTION get_my_trip_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT trip_id FROM trip_participants WHERE user_id = auth.uid();
$$;

-- Reset Expenses Policies
DROP POLICY IF EXISTS "Expenses viewable by trip members." ON expenses;
DROP POLICY IF EXISTS "access_expenses" ON expenses;
CREATE POLICY "access_expenses" ON expenses FOR SELECT USING (
  trip_id IN ( SELECT get_my_trip_ids() )
);

DROP POLICY IF EXISTS "Expenses insertable by trip members." ON expenses;
DROP POLICY IF EXISTS "insert_expenses" ON expenses;
CREATE POLICY "insert_expenses" ON expenses FOR INSERT WITH CHECK (
  trip_id IN ( SELECT get_my_trip_ids() )
);

DROP POLICY IF EXISTS "Delete_Expenses" ON expenses;
DROP POLICY IF EXISTS "delete_expenses" ON expenses;
CREATE POLICY "delete_expenses" ON expenses FOR DELETE USING (
  trip_id IN ( SELECT get_my_trip_ids() )
);

COMMIT;
