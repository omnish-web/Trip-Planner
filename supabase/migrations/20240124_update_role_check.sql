-- 1. Drop existing constraint
ALTER TABLE trip_participants DROP CONSTRAINT IF EXISTS trip_participants_role_check;

-- 2. Migrate legacy 'member' role to 'editor'
UPDATE trip_participants SET role = 'editor' WHERE role = 'member';

-- 3. Add new, more permissive constraint
ALTER TABLE trip_participants ADD CONSTRAINT trip_participants_role_check 
CHECK (role IN ('owner', 'editor', 'viewer'));
