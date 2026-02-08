-- Fix expense_splits DELETE/UPDATE policy
-- Run this in Supabase SQL Editor

-- Create helper function if it doesn't exist
CREATE OR REPLACE FUNCTION is_trip_member(trip_id_arg uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_participants 
    WHERE trip_id = trip_id_arg
    AND user_id = auth.uid()
  );
$$;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "modify_splits" ON expense_splits;
DROP POLICY IF EXISTS "delete_splits" ON expense_splits;
DROP POLICY IF EXISTS "update_splits" ON expense_splits;

-- Create comprehensive policy for ALL operations (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "modify_splits" ON expense_splits FOR ALL USING (
  EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND is_trip_member(trip_id))
);

-- Alternative: If the above doesn't work, create separate policies
-- DROP POLICY IF EXISTS "modify_splits" ON expense_splits;
-- 
-- CREATE POLICY "delete_splits" ON expense_splits FOR DELETE USING (
--   EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND is_trip_member(trip_id))
-- );
-- 
-- CREATE POLICY "update_splits" ON expense_splits FOR UPDATE USING (
--   EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND is_trip_member(trip_id))
-- );
-- 
-- CREATE POLICY "insert_splits" ON expense_splits FOR INSERT WITH CHECK (
--   EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND is_trip_member(trip_id))
-- );
