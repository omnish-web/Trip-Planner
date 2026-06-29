-- Fix the role insertion constraint violation for Accept Invite
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

  -- 2. Insert into trip_participants with the correct modern role 'editor'
  INSERT INTO trip_participants (trip_id, user_id, role) 
  VALUES (v_invite.trip_id, v_invite.invitee_id, 'editor')
  ON CONFLICT DO NOTHING;

  RETURN json_build_object('success', true, 'trip_id', v_invite.trip_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Fix the role insertion constraint violation for Direct Add
CREATE OR REPLACE FUNCTION direct_add_user(p_username_id text, p_passcode text, p_trip_id uuid)
RETURNS json AS $$
DECLARE
  v_user_id uuid;
  v_passcode text;
  v_inviter_role text;
BEGIN
  -- Check if inviter is in the trip
  SELECT role INTO v_inviter_role FROM trip_participants WHERE trip_id = p_trip_id AND user_id = auth.uid();
  IF v_inviter_role IS NULL THEN
    RAISE EXCEPTION 'You are not a participant of this trip.';
  END IF;

  -- Find user by username_id
  SELECT id INTO v_user_id FROM profiles WHERE username_id = p_username_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found.';
  END IF;

  -- Verify passcode
  SELECT passcode INTO v_passcode FROM user_secrets WHERE user_id = v_user_id;
  IF v_passcode != p_passcode THEN
    RAISE EXCEPTION 'Invalid passcode.';
  END IF;

  -- Check if already in trip
  IF EXISTS (SELECT 1 FROM trip_participants WHERE trip_id = p_trip_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'User is already in this trip.';
  END IF;

  -- Insert into trip_participants with the correct modern role 'editor'
  INSERT INTO trip_participants (trip_id, user_id, role) VALUES (p_trip_id, v_user_id, 'editor');

  RETURN json_build_object('success', true, 'user_id', v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
