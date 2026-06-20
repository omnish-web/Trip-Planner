-- FIX INFINITE RECURSION IN POLICIES
-- Run this script to reset all policies and fix the "infinite recursion" error.

-- 1. Drop existing policies to ensure a clean slate
DROP POLICY IF EXISTS "Participants viewable by trip members." ON trip_participants;
DROP POLICY IF EXISTS "Allow adding guests." ON trip_participants;
DROP POLICY IF EXISTS "Expenses viewable by trip members." ON expenses;
DROP POLICY IF EXISTS "Expenses insertable by trip members." ON expenses;
DROP POLICY IF EXISTS "Splits viewable by trip members." ON expense_splits;
DROP POLICY IF EXISTS "Splits insertable by trip members." ON expense_splits;

-- 2. Create Helper Function (SECURITY DEFINER)
-- This function runs with the privileges of the creator (postgres), bypassing RLS.
-- This breaks the recursion loop when policies check trip membership.
CREATE OR REPLACE FUNCTION get_my_trip_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT trip_id FROM trip_participants WHERE user_id = auth.uid();
$$;

-- 3. Re-create Policies using the Helper Function

-- Trip Participants
-- SELECT: View if you are in the trip (via helper)
CREATE POLICY "Participants viewable by trip members." ON trip_participants FOR SELECT USING (
  trip_id IN ( SELECT get_my_trip_ids() )
);

-- INSERT: Allow adding guests if you are in the trip (via helper)
CREATE POLICY "Allow adding guests." ON trip_participants FOR INSERT WITH CHECK (
  trip_id IN ( SELECT get_my_trip_ids() )
);

-- Expenses
CREATE POLICY "Expenses viewable by trip members." ON expenses FOR SELECT USING (
  trip_id IN ( SELECT get_my_trip_ids() )
);

CREATE POLICY "Expenses insertable by trip members." ON expenses FOR INSERT WITH CHECK (
  trip_id IN ( SELECT get_my_trip_ids() )
);

-- Splits
CREATE POLICY "Splits viewable by trip members." ON expense_splits FOR SELECT USING (
  expense_id IN (
      SELECT id FROM expenses WHERE trip_id IN ( SELECT get_my_trip_ids() )
  )
);

CREATE POLICY "Splits insertable by trip members." ON expense_splits FOR INSERT WITH CHECK (
  expense_id IN (
      SELECT id FROM expenses WHERE trip_id IN ( SELECT get_my_trip_ids() )
  )
);

-- 4. Ensure RLS is enabled
ALTER TABLE trip_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
