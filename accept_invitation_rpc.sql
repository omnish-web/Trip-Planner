-- Fix for accepting invitations:
-- Since RLS policies on trip_participants prevent non-members from inserting,
-- we use a SECURITY DEFINER function to bypass RLS when a user accepts their own invite.

CREATE OR REPLACE FUNCTION accept_trip_invitation(p_invite_id uuid)
RETURNS json AS $$
DECLARE
  v_invite RECORD;
BEGIN
  -- Fetch the invite
  SELECT * INTO v_invite FROM trip_invitations WHERE id = p_invite_id;
  
  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invitation not found.';
  END IF;

  -- Verify the invite belongs to the current user
  IF v_invite.invitee_id != auth.uid() THEN
    RAISE EXCEPTION 'You can only accept your own invitations.';
  END IF;

  -- Ensure it's not already accepted
  IF v_invite.status = 'accepted' THEN
    RAISE EXCEPTION 'Invitation is already accepted.';
  END IF;

  -- 1. Update the invitation status to accepted
  UPDATE trip_invitations SET status = 'accepted' WHERE id = p_invite_id;

  -- 2. Insert into trip_participants
  -- We use ON CONFLICT DO NOTHING just in case they were added through another method simultaneously
  INSERT INTO trip_participants (trip_id, user_id, role) 
  VALUES (v_invite.trip_id, v_invite.invitee_id, 'member')
  ON CONFLICT DO NOTHING;

  RETURN json_build_object('success', true, 'trip_id', v_invite.trip_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
