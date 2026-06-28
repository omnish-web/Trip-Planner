-- Fix for "Unknown Trip" on the receipt side
-- Drop the old flawed policy first
DROP POLICY IF EXISTS "Trips viewable by invitees" ON trips;

-- Recreate with explicit table references to avoid ambiguity
CREATE POLICY "Trips viewable by invitees" ON trips FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM trip_invitations 
    WHERE trip_invitations.trip_id = trips.id 
    AND trip_invitations.invitee_id = auth.uid() 
    AND trip_invitations.status = 'pending'
  )
);
