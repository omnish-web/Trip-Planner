-- FINAL RECURSION FIX (NUKE APPROACH)
-- This script dynamically finds and drops ALL policies on trip_participants and expenses
-- to ensure NO conflicting policies remain. Then it re-applies the correct ones.

BEGIN;

-- 1. NUKE ALL POLICIES on trip_participants
DO $$ 
DECLARE 
    pol record; 
BEGIN 
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'trip_participants' 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON trip_participants', pol.policyname); 
    END LOOP; 
END $$;

-- 2. NUKE ALL POLICIES on expenses
DO $$ 
DECLARE 
    pol record; 
BEGIN 
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'expenses' 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON expenses', pol.policyname); 
    END LOOP; 
END $$;

-- 3. NUKE ALL POLICIES on expense_splits
DO $$ 
DECLARE 
    pol record; 
BEGIN 
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'expense_splits' 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON expense_splits', pol.policyname); 
    END LOOP; 
END $$;


-- 4. CREATE ROBUST SECURITY DEFINER FUNCTION
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


-- 5. RE-APPLY POLICIES

-- Trip Participants
-- View: users can see themselves, OR if they are a member of the trip
CREATE POLICY "view_participants" ON trip_participants FOR SELECT USING (
  user_id = auth.uid() OR is_trip_member(trip_id)
);

-- Insert: Users can add participants (guests) if they are a member of the trip
-- Note: 'is_trip_member' works because the user is ALREADY in the table (triggering the check)
-- When adding a *new* row, the user must be an *existing* member of that trip_id.
CREATE POLICY "insert_participants" ON trip_participants FOR INSERT WITH CHECK (
  is_trip_member(trip_id)
);

-- Update/Delete: Members can manage participants
CREATE POLICY "modify_participants" ON trip_participants FOR ALL USING (
  is_trip_member(trip_id)
);


-- Expenses
CREATE POLICY "view_expenses" ON expenses FOR SELECT USING (
  is_trip_member(trip_id)
);

CREATE POLICY "modify_expenses" ON expenses FOR ALL USING (
  is_trip_member(trip_id)
);


-- Expense Splits
CREATE POLICY "view_splits" ON expense_splits FOR SELECT USING (
  EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND is_trip_member(trip_id))
);

CREATE POLICY "modify_splits" ON expense_splits FOR ALL USING (
  EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND is_trip_member(trip_id))
);

COMMIT;
