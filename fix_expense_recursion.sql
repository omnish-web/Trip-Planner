-- Final Fix for Expense Policies to Prevent Any RLS Recursion or Visibility Issues
-- By using a SECURITY DEFINER function, we bypass all nested RLS checks safely.

BEGIN;

-- 1. Create a secure helper function to check permissions directly
CREATE OR REPLACE FUNCTION can_modify_expense(exp_trip_id uuid, exp_paid_by uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_participants 
    WHERE trip_id = exp_trip_id AND user_id = auth.uid() AND role = 'owner'
  )
  OR 
  EXISTS (
    SELECT 1 FROM trip_participants
    WHERE id = exp_paid_by AND user_id = auth.uid()
  );
$$;

-- 2. Drop the potentially recursive policies on expenses
DROP POLICY IF EXISTS "Expenses updatable by owner or payer" ON expenses;
DROP POLICY IF EXISTS "Expenses deletable by owner or payer" ON expenses;

-- 3. Apply the secure, non-recursive policies
CREATE POLICY "Expenses updatable by owner or payer" ON expenses FOR UPDATE USING (
  can_modify_expense(trip_id, paid_by)
);

CREATE POLICY "Expenses deletable by owner or payer" ON expenses FOR DELETE USING (
  can_modify_expense(trip_id, paid_by)
);

COMMIT;
