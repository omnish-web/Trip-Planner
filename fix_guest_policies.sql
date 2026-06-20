-- FIX GUEST ADDITION RECURSION
-- This script cleans up ALL potential conflicting policies on 'trip_participants' 
-- and enforces the correct, non-recursive logic.

BEGIN;

--------------------------------------------------------------------------------
-- 1. DROP ALL POTENTIAL POLICIES (Clean Slate)
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants viewable by trip members." ON trip_participants;
DROP POLICY IF EXISTS "Allow adding guests." ON trip_participants;
DROP POLICY IF EXISTS "Select_Participants" ON trip_participants;
DROP POLICY IF EXISTS "Insert_Guests" ON trip_participants;
DROP POLICY IF EXISTS "access_participants" ON trip_participants;
DROP POLICY IF EXISTS "insert_participants" ON trip_participants;
DROP POLICY IF EXISTS "Enable read access for all users" ON trip_participants;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON trip_participants;
DROP POLICY IF EXISTS "Any logged in user can view stats" ON trip_participants;

--------------------------------------------------------------------------------
-- 2. RE-VERIFY HELPER FUNCTION
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_trip_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT trip_id FROM trip_participants WHERE user_id = auth.uid();
$$;

--------------------------------------------------------------------------------
-- 3. APPLY CORRECT POLICIES
--------------------------------------------------------------------------------

-- VIEW: Visible if you are in the trip (via User ID)
-- We check:
-- 1. Is the row my own user row? (user_id = auth.uid())
-- 2. OR is the row part of a trip I'm in? (trip_id IN get_my_trip_ids())
CREATE POLICY "view_participants" ON trip_participants FOR SELECT USING (
  user_id = auth.uid() OR 
  trip_id IN ( SELECT get_my_trip_ids() )
);

-- INSERT: Allowed if you are a member of the trip
-- When adding a guest, we check if the user is ALREADY in the trip.
CREATE POLICY "add_participants" ON trip_participants FOR INSERT WITH CHECK (
  trip_id IN ( SELECT get_my_trip_ids() )
);

-- UPDATE: Allowed if you are a member
CREATE POLICY "update_participants" ON trip_participants FOR UPDATE USING (
  trip_id IN ( SELECT get_my_trip_ids() )
);

-- DELETE: Allowed if you are a member (e.g. removing a guest)
CREATE POLICY "delete_participants" ON trip_participants FOR DELETE USING (
  trip_id IN ( SELECT get_my_trip_ids() )
);


--------------------------------------------------------------------------------
-- 4. VERIFY OTHER TABLES (Just in case)
--------------------------------------------------------------------------------
-- Ensure expenses policies are using the helper too
DROP POLICY IF EXISTS "Expenses viewable by trip members." ON expenses;
DROP POLICY IF EXISTS "Expenses insertable by trip members." ON expenses;
DROP POLICY IF EXISTS "access_expenses" ON expenses; -- Drop old ones

CREATE POLICY "access_expenses_v2" ON expenses FOR SELECT USING (
  trip_id IN ( SELECT get_my_trip_ids() )
);
CREATE POLICY "modify_expenses_v2" ON expenses FOR ALL USING (
  trip_id IN ( SELECT get_my_trip_ids() )
);

COMMIT;
