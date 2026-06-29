-- Complete RLS Restoration for Expenses, Splits, and Payers
-- Safely using inline checks without relying on custom DB functions.

BEGIN;

--------------------------------------------------------------------------------
-- 1. DROP ALL EXISTING POLICIES ON EXPENSE TABLES TO START FRESH
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "delete_expenses" ON expenses;
DROP POLICY IF EXISTS "update_expenses" ON expenses;
DROP POLICY IF EXISTS "modify_expenses" ON expenses;
DROP POLICY IF EXISTS "modify_expenses_v2" ON expenses;
DROP POLICY IF EXISTS "access_expenses_v2" ON expenses;
DROP POLICY IF EXISTS "Expenses deletable by trip members." ON expenses;
DROP POLICY IF EXISTS "Expenses updatable by trip members." ON expenses;
DROP POLICY IF EXISTS "Delete_Expenses" ON expenses;
DROP POLICY IF EXISTS "Expenses deletable by trip members" ON expenses;
DROP POLICY IF EXISTS "Expenses updatable by trip members" ON expenses;
DROP POLICY IF EXISTS "Expenses deletable by owner or payer" ON expenses;
DROP POLICY IF EXISTS "Expenses updatable by owner or payer" ON expenses;
DROP POLICY IF EXISTS "access_expenses" ON expenses;
DROP POLICY IF EXISTS "insert_expenses" ON expenses;
DROP POLICY IF EXISTS "Expenses viewable by trip members." ON expenses;
DROP POLICY IF EXISTS "Expenses insertable by trip members." ON expenses;
DROP POLICY IF EXISTS "Expenses viewable by members" ON expenses;
DROP POLICY IF EXISTS "Expenses insertable by members" ON expenses;


DROP POLICY IF EXISTS "Splits deletable by owner or payer" ON expense_splits;
DROP POLICY IF EXISTS "delete_expense_splits" ON expense_splits;
DROP POLICY IF EXISTS "Splits deletable by trip members" ON expense_splits;
DROP POLICY IF EXISTS "modify_splits" ON expense_splits;
DROP POLICY IF EXISTS "access_splits" ON expense_splits;
DROP POLICY IF EXISTS "insert_splits" ON expense_splits;
DROP POLICY IF EXISTS "delete_splits" ON expense_splits;
DROP POLICY IF EXISTS "update_splits" ON expense_splits;
DROP POLICY IF EXISTS "Splits viewable by trip members." ON expense_splits;
DROP POLICY IF EXISTS "Splits insertable by trip members." ON expense_splits;
DROP POLICY IF EXISTS "Select_Splits" ON expense_splits;
DROP POLICY IF EXISTS "Insert_Splits" ON expense_splits;
DROP POLICY IF EXISTS "view_splits" ON expense_splits;
DROP POLICY IF EXISTS "Splits viewable by members" ON expense_splits;
DROP POLICY IF EXISTS "Splits insertable by members" ON expense_splits;
DROP POLICY IF EXISTS "Splits updatable by members" ON expense_splits;
DROP POLICY IF EXISTS "Splits deletable by members" ON expense_splits;

DROP POLICY IF EXISTS "Payers deletable by owner or payer" ON expense_payers;
DROP POLICY IF EXISTS "delete_expense_payers" ON expense_payers;
DROP POLICY IF EXISTS "Payers deletable by trip members" ON expense_payers;
DROP POLICY IF EXISTS "access_payers" ON expense_payers;
DROP POLICY IF EXISTS "insert_payers" ON expense_payers;
DROP POLICY IF EXISTS "modify_payers" ON expense_payers;
DROP POLICY IF EXISTS "view_payers" ON expense_payers;
DROP POLICY IF EXISTS "Payers viewable by members" ON expense_payers;
DROP POLICY IF EXISTS "Payers insertable by members" ON expense_payers;
DROP POLICY IF EXISTS "Payers updatable by members" ON expense_payers;
DROP POLICY IF EXISTS "Payers deletable by members" ON expense_payers;


--------------------------------------------------------------------------------
-- 2. CREATE POLICIES FOR EXPENSES
--------------------------------------------------------------------------------

-- SELECT: All trip members can view expenses
CREATE POLICY "Expenses viewable by members" ON expenses FOR SELECT USING (
  trip_id IN (SELECT trip_id FROM trip_participants WHERE user_id = auth.uid())
);

-- INSERT: All trip members can add expenses
CREATE POLICY "Expenses insertable by members" ON expenses FOR INSERT WITH CHECK (
  trip_id IN (SELECT trip_id FROM trip_participants WHERE user_id = auth.uid())
);

-- UPDATE: Only Owner or the Payer can update
CREATE POLICY "Expenses updatable by owner or payer" ON expenses FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM trip_participants 
    WHERE trip_id = expenses.trip_id AND user_id = auth.uid() AND role = 'owner'
  )
  OR 
  EXISTS (
    SELECT 1 FROM trip_participants
    WHERE id = expenses.paid_by AND user_id = auth.uid()
  )
);

-- DELETE: Only Owner or the Payer can delete
CREATE POLICY "Expenses deletable by owner or payer" ON expenses FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM trip_participants 
    WHERE trip_id = expenses.trip_id AND user_id = auth.uid() AND role = 'owner'
  )
  OR 
  EXISTS (
    SELECT 1 FROM trip_participants
    WHERE id = expenses.paid_by AND user_id = auth.uid()
  )
);

--------------------------------------------------------------------------------
-- 3. CREATE POLICIES FOR EXPENSE_SPLITS
--------------------------------------------------------------------------------

-- SELECT: All trip members can view splits
CREATE POLICY "Splits viewable by members" ON expense_splits FOR SELECT USING (
  expense_id IN (SELECT id FROM expenses WHERE trip_id IN (SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()))
);

-- INSERT: All trip members can add splits
CREATE POLICY "Splits insertable by members" ON expense_splits FOR INSERT WITH CHECK (
  expense_id IN (SELECT id FROM expenses WHERE trip_id IN (SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()))
);

-- UPDATE: All trip members can update splits
CREATE POLICY "Splits updatable by members" ON expense_splits FOR UPDATE USING (
  expense_id IN (SELECT id FROM expenses WHERE trip_id IN (SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()))
);

-- DELETE: All trip members can delete splits
CREATE POLICY "Splits deletable by members" ON expense_splits FOR DELETE USING (
  expense_id IN (SELECT id FROM expenses WHERE trip_id IN (SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()))
);

--------------------------------------------------------------------------------
-- 4. CREATE POLICIES FOR EXPENSE_PAYERS
--------------------------------------------------------------------------------

-- SELECT: All trip members can view payers
CREATE POLICY "Payers viewable by members" ON expense_payers FOR SELECT USING (
  expense_id IN (SELECT id FROM expenses WHERE trip_id IN (SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()))
);

-- INSERT: All trip members can add payers
CREATE POLICY "Payers insertable by members" ON expense_payers FOR INSERT WITH CHECK (
  expense_id IN (SELECT id FROM expenses WHERE trip_id IN (SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()))
);

-- UPDATE: All trip members can update payers
CREATE POLICY "Payers updatable by members" ON expense_payers FOR UPDATE USING (
  expense_id IN (SELECT id FROM expenses WHERE trip_id IN (SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()))
);

-- DELETE: All trip members can delete payers
CREATE POLICY "Payers deletable by members" ON expense_payers FOR DELETE USING (
  expense_id IN (SELECT id FROM expenses WHERE trip_id IN (SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()))
);

COMMIT;
