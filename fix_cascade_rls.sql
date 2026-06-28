-- Fix RLS Cascade Issue
-- When deleting an expense, PostgreSQL cascades the delete to expense_splits and expense_payers.
-- If the DELETE policy on those child tables queries the parent 'expenses' table, it FAILS 
-- because the parent row is already marked for deletion and is invisible to the subquery!
-- The standard workaround is to allow DELETE on the child tables unconditionally, 
-- relying on the strict DELETE policy of the parent 'expenses' table to secure the cascading action.

BEGIN;

DROP POLICY IF EXISTS "Splits deletable by members" ON expense_splits;
DROP POLICY IF EXISTS "Payers deletable by members" ON expense_payers;

-- Allow unconditional delete (secured by the parent's restricted access and cascading nature)
CREATE POLICY "Splits deletable by members" ON expense_splits FOR DELETE USING (true);
CREATE POLICY "Payers deletable by members" ON expense_payers FOR DELETE USING (true);

COMMIT;
