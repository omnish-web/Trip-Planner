-- Enforce Strict Control: Owners can manage all expenses, Members can manage their own expenses

-- 1. Drop the previously created policies
DROP POLICY IF EXISTS "Expenses deletable by trip members" ON expenses;
DROP POLICY IF EXISTS "Expenses updatable by trip members" ON expenses;
DROP POLICY IF EXISTS "Splits deletable by trip members" ON expense_splits;
DROP POLICY IF EXISTS "Payers deletable by trip members" ON expense_payers;
DROP POLICY IF EXISTS "Expenses deletable by owner or payer" ON expenses;
DROP POLICY IF EXISTS "Expenses updatable by owner or payer" ON expenses;
DROP POLICY IF EXISTS "Splits deletable by owner or payer" ON expense_splits;
DROP POLICY IF EXISTS "Payers deletable by owner or payer" ON expense_payers;

-- 2. Create strictly constrained DELETE policy for expenses
CREATE POLICY "Expenses deletable by owner or payer" 
ON expenses FOR DELETE 
USING (
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

-- 3. Create strictly constrained UPDATE policy for expenses
CREATE POLICY "Expenses updatable by owner or payer" 
ON expenses FOR UPDATE 
USING (
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


-- 4. Create strictly constrained DELETE policy for expense_splits
CREATE POLICY "Splits deletable by owner or payer" 
ON expense_splits FOR DELETE 
USING (
  expense_id IN (
    SELECT id FROM expenses WHERE 
      EXISTS (
        SELECT 1 FROM trip_participants 
        WHERE trip_id = expenses.trip_id AND user_id = auth.uid() AND role = 'owner'
      )
      OR 
      EXISTS (
        SELECT 1 FROM trip_participants
        WHERE id = expenses.paid_by AND user_id = auth.uid()
      )
  )
);

-- 5. Create strictly constrained DELETE policy for expense_payers
CREATE POLICY "Payers deletable by owner or payer" 
ON expense_payers FOR DELETE 
USING (
  expense_id IN (
    SELECT id FROM expenses WHERE 
      EXISTS (
        SELECT 1 FROM trip_participants 
        WHERE trip_id = expenses.trip_id AND user_id = auth.uid() AND role = 'owner'
      )
      OR 
      EXISTS (
        SELECT 1 FROM trip_participants
        WHERE id = expenses.paid_by AND user_id = auth.uid()
      )
  )
);
