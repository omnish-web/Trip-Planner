-- Full RLS Fix using SECURITY DEFINER for ALL Expense Policies
-- This completely isolates all expense policies from triggering nested RLS evaluations.

BEGIN;

-- 1. Create a secure helper function to check if user is a member of the trip
CREATE OR REPLACE FUNCTION is_trip_member_secure(exp_trip_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_participants 
    WHERE trip_id = exp_trip_id AND user_id = auth.uid()
  );
$$;

-- 2. Drop all inline policies that might be causing infinite recursion or 500 errors
DROP POLICY IF EXISTS "Expenses viewable by members" ON expenses;
DROP POLICY IF EXISTS "Expenses insertable by members" ON expenses;
DROP POLICY IF EXISTS "Splits viewable by members" ON expense_splits;
DROP POLICY IF EXISTS "Splits insertable by members" ON expense_splits;
DROP POLICY IF EXISTS "Splits updatable by members" ON expense_splits;
DROP POLICY IF EXISTS "Payers viewable by members" ON expense_payers;
DROP POLICY IF EXISTS "Payers insertable by members" ON expense_payers;
DROP POLICY IF EXISTS "Payers updatable by members" ON expense_payers;

-- 3. Re-apply policies using the SECURE function

-- Expenses
CREATE POLICY "Expenses viewable by members" ON expenses FOR SELECT USING (
  is_trip_member_secure(trip_id)
);
CREATE POLICY "Expenses insertable by members" ON expenses FOR INSERT WITH CHECK (
  is_trip_member_secure(trip_id)
);

-- Expense Splits
CREATE POLICY "Splits viewable by members" ON expense_splits FOR SELECT USING (
  EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND is_trip_member_secure(trip_id))
);
CREATE POLICY "Splits insertable by members" ON expense_splits FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND is_trip_member_secure(trip_id))
);
CREATE POLICY "Splits updatable by members" ON expense_splits FOR UPDATE USING (
  EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND is_trip_member_secure(trip_id))
);

-- Expense Payers
CREATE POLICY "Payers viewable by members" ON expense_payers FOR SELECT USING (
  EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND is_trip_member_secure(trip_id))
);
CREATE POLICY "Payers insertable by members" ON expense_payers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND is_trip_member_secure(trip_id))
);
CREATE POLICY "Payers updatable by members" ON expense_payers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND is_trip_member_secure(trip_id))
);

COMMIT;
