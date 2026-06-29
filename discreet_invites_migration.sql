-- Add discreet deletion flags for trip invitations
ALTER TABLE trip_invitations ADD COLUMN IF NOT EXISTS inviter_deleted boolean DEFAULT false;
ALTER TABLE trip_invitations ADD COLUMN IF NOT EXISTS invitee_deleted boolean DEFAULT false;

-- Drop any previous deletion policies to switch to soft deletes safely
DROP POLICY IF EXISTS "Invitee can delete invite" ON trip_invitations;
DROP POLICY IF EXISTS "Inviter can delete invite" ON trip_invitations;

-- Create policies that allow the inviter and invitee to UPDATE their respective flags
CREATE POLICY "Inviter can hide own invite" ON trip_invitations FOR UPDATE USING (auth.uid() = inviter_id);
CREATE POLICY "Invitee can hide own invite" ON trip_invitations FOR UPDATE USING (auth.uid() = invitee_id);
