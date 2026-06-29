-- Fix for Trips viewable by invitees regardless of status
DROP POLICY IF EXISTS "Trips viewable by invitees" ON trips;

CREATE POLICY "Trips viewable by invitees" ON trips FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM trip_invitations 
    WHERE trip_invitations.trip_id = trips.id 
    AND trip_invitations.invitee_id = auth.uid() 
  )
);

-- Allow invitees to delete their own invitations from their dashboard
DROP POLICY IF EXISTS "Invitee can delete invite" ON trip_invitations;

CREATE POLICY "Invitee can delete invite" ON trip_invitations 
  FOR DELETE USING (auth.uid() = invitee_id);
