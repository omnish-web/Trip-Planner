-- Give Trip Owners full control over all trip notes, attachments, expenses, and splits
-- Regular members can only manage their own items.

-- ==========================================
-- 1. TRIP NOTES & ATTACHMENTS POLICIES
-- ==========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Note authors can delete their own notes" ON trip_notes;
DROP POLICY IF EXISTS "Note authors can update their own notes" ON trip_notes;
DROP POLICY IF EXISTS "Attachment owners can delete attachments" ON trip_note_attachments;

-- Create updated policies for trip_notes (DELETE)
CREATE POLICY "Authors and Owners can delete notes"
ON trip_notes FOR DELETE
USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM trip_participants 
        WHERE trip_id = trip_notes.trip_id AND user_id = auth.uid() AND role = 'owner'
    )
);

-- Create updated policies for trip_notes (UPDATE)
CREATE POLICY "Authors and Owners can update notes"
ON trip_notes FOR UPDATE
USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM trip_participants 
        WHERE trip_id = trip_notes.trip_id AND user_id = auth.uid() AND role = 'owner'
    )
);

-- Create updated policies for trip_note_attachments (DELETE)
CREATE POLICY "Authors and Owners can delete attachments"
ON trip_note_attachments FOR DELETE
USING (
    note_id IN (
        SELECT id FROM trip_notes WHERE user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM trip_participants 
            WHERE trip_id = trip_notes.trip_id AND user_id = auth.uid() AND role = 'owner'
        )
    )
);


-- ==========================================
-- 2. EXPENSES, SPLITS & PAYERS POLICIES
-- ==========================================

-- Drop existing delete/update policies for expenses to avoid conflicts
DROP POLICY IF EXISTS "delete_expenses" ON expenses;
DROP POLICY IF EXISTS "update_expenses" ON expenses;
DROP POLICY IF EXISTS "modify_expenses" ON expenses;
DROP POLICY IF EXISTS "modify_expenses_v2" ON expenses;
DROP POLICY IF EXISTS "Expenses deletable by trip members." ON expenses;
DROP POLICY IF EXISTS "Expenses updatable by trip members." ON expenses;
DROP POLICY IF EXISTS "Delete_Expenses" ON expenses;
DROP POLICY IF EXISTS "Expenses deletable by trip members" ON expenses;
DROP POLICY IF EXISTS "Expenses updatable by trip members" ON expenses;
DROP POLICY IF EXISTS "Expenses deletable by owner or payer" ON expenses;
DROP POLICY IF EXISTS "Expenses updatable by owner or payer" ON expenses;
DROP POLICY IF EXISTS "Splits deletable by owner or payer" ON expense_splits;
DROP POLICY IF EXISTS "Payers deletable by owner or payer" ON expense_payers;
DROP POLICY IF EXISTS "delete_expense_splits" ON expense_splits;
DROP POLICY IF EXISTS "Splits deletable by trip members" ON expense_splits;
DROP POLICY IF EXISTS "delete_expense_payers" ON expense_payers;
DROP POLICY IF EXISTS "Payers deletable by trip members" ON expense_payers;

-- Create strictly constrained DELETE policy for expenses
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

-- Create strictly constrained UPDATE policy for expenses
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

-- Create strictly constrained DELETE policy for expense_splits
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

-- Create strictly constrained DELETE policy for expense_payers
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
