-- EMERGENCY REPAIR SCRIPT
-- Goal: Fix Foreign Key violations, infinite recursion, and ensure schema matches the new Guest User logic.

BEGIN;

-- 1. FIX TRIP PARTICIPANTS
-- Ensure ID matches user_id logic if needed, but primarily ensure columns exist.

-- Add columns if missing
DO $$ BEGIN
    ALTER TABLE trip_participants ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
    ALTER TABLE trip_participants ADD COLUMN IF NOT EXISTS name text;
    ALTER TABLE trip_participants ALTER COLUMN user_id DROP NOT NULL;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- Fix Primary Key
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_participants_pkey') THEN
        ALTER TABLE trip_participants DROP CONSTRAINT trip_participants_pkey CASCADE;
    END IF;
    ALTER TABLE trip_participants ADD CONSTRAINT trip_participants_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN others THEN NULL; -- Might already be PK
END $$;


-- 2. FIX EXPENSES FK CONSTRAINT
-- The specific error "violates expenses_paid_by_fkey" implies the OLD constraint is still there or points to USERS.

-- Drop known constraints to clear the way
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_paid_by_fkey;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_paid_by_participant_id_fkey;

-- Ensure paid_by column is correct
DO $$ BEGIN
    -- Check if we need to migration data from user_id to participant_id
    -- If 'paid_by' is still referencing users (implied by the error), we might need to fix the data.
    -- However, we can't easily check validation inside DO block.
    
    -- Let's just create the column 'paid_by_participant' if it doesn't exist, migrate, and swap.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'paid_by_participant_id') THEN
        ALTER TABLE expenses ADD COLUMN paid_by_participant_id uuid REFERENCES trip_participants(id);
        
        -- Migrate Data
        UPDATE expenses e
        SET paid_by_participant_id = tp.id
        FROM trip_participants tp
        WHERE e.trip_id = tp.trip_id AND e.paid_by::text = tp.user_id::text;
        
        -- Drop old and rename
        ALTER TABLE expenses DROP COLUMN paid_by CASCADE;
        ALTER TABLE expenses RENAME COLUMN paid_by_participant_id TO paid_by;
    ELSE
        -- Column exists, maybe rename failed?
        -- If 'paid_by' does NOT exist but 'paid_by_participant_id' DOES, rename it.
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'paid_by') THEN
            ALTER TABLE expenses RENAME COLUMN paid_by_participant_id TO paid_by;
        END IF;
    END IF;
END $$;

-- NOW, add the correct constraint
-- Ensure paid_by references trip_participants(id)
ALTER TABLE expenses ADD CONSTRAINT expenses_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES trip_participants(id);


-- 3. FIX EXPENSE SPLITS
ALTER TABLE expense_splits DROP CONSTRAINT IF EXISTS expense_splits_user_id_fkey;
ALTER TABLE expense_splits DROP CONSTRAINT IF EXISTS expense_splits_participant_id_fkey;

DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expense_splits' AND column_name = 'participant_id') THEN
        ALTER TABLE expense_splits ADD COLUMN participant_id uuid REFERENCES trip_participants(id);
        
        UPDATE expense_splits es
        SET participant_id = tp.id
        FROM expenses e
        JOIN trip_participants tp ON e.trip_id = tp.trip_id
        WHERE es.expense_id = e.id AND es.user_id::text = tp.user_id::text;
        
        ALTER TABLE expense_splits DROP COLUMN user_id CASCADE;
    ELSE
         -- ensure rename happened
         IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expense_splits' AND column_name = 'user_id') THEN
             -- migrate any stragglers
            UPDATE expense_splits es
            SET participant_id = tp.id
            FROM expenses e
            JOIN trip_participants tp ON e.trip_id = tp.trip_id
            WHERE es.expense_id = e.id AND es.user_id::text = tp.user_id::text
            AND es.participant_id IS NULL;
            
            ALTER TABLE expense_splits DROP COLUMN user_id CASCADE;
         END IF;
    END IF;
END $$;

ALTER TABLE expense_splits ADD CONSTRAINT expense_splits_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES trip_participants(id);


-- 4. FIX POLICIES (RECURSION)
-- Drop EVERYTHING related to RLS on these tables
DROP POLICY IF EXISTS "Participants viewable by trip members." ON trip_participants;
DROP POLICY IF EXISTS "Allow adding guests." ON trip_participants;
DROP POLICY IF EXISTS "Expenses viewable by trip members." ON expenses;
DROP POLICY IF EXISTS "Expenses insertable by trip members." ON expenses;
DROP POLICY IF EXISTS "Splits viewable by trip members." ON expense_splits;
DROP POLICY IF EXISTS "Splits insertable by trip members." ON expense_splits;
-- Drop potentially old named policies
DROP POLICY IF EXISTS "Enable read access for all users" ON trip_participants;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON trip_participants;

-- Correct Function
CREATE OR REPLACE FUNCTION get_my_trip_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT trip_id FROM trip_participants WHERE user_id = auth.uid();
$$;

-- Trip Participants (Simple non-recursive check for Insert? No, must check trip membership)
CREATE POLICY "Select_Participants" ON trip_participants FOR SELECT USING (
  trip_id IN ( SELECT get_my_trip_ids() )
);

CREATE POLICY "Insert_Guests" ON trip_participants FOR INSERT WITH CHECK (
  trip_id IN ( SELECT get_my_trip_ids() )
);

-- Expenses
CREATE POLICY "Select_Expenses" ON expenses FOR SELECT USING (
  trip_id IN ( SELECT get_my_trip_ids() )
);
CREATE POLICY "Insert_Expenses" ON expenses FOR INSERT WITH CHECK (
  trip_id IN ( SELECT get_my_trip_ids() )
);
CREATE POLICY "Delete_Expenses" ON expenses FOR DELETE USING (
  trip_id IN ( SELECT get_my_trip_ids() )
);

-- Splits
CREATE POLICY "Select_Splits" ON expense_splits FOR SELECT USING (
  expense_id IN ( SELECT id FROM expenses WHERE trip_id IN (SELECT get_my_trip_ids()) )
);
CREATE POLICY "Insert_Splits" ON expense_splits FOR INSERT WITH CHECK (
  expense_id IN ( SELECT id FROM expenses WHERE trip_id IN (SELECT get_my_trip_ids()) )
);

COMMIT;
