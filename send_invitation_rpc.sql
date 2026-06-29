-- RPC to securely send/resend a trip invitation bypassing RLS update restrictions

CREATE OR REPLACE FUNCTION send_trip_invitation(p_trip_id uuid, p_invitee_id uuid)
RETURNS json AS $$
DECLARE
  v_inviter_role text;
BEGIN
  -- 1. Verify the current user is actually in the trip
  SELECT role INTO v_inviter_role FROM trip_participants 
  WHERE trip_id = p_trip_id AND user_id = auth.uid();
  
  IF v_inviter_role IS NULL THEN
    RAISE EXCEPTION 'You must be a member of this trip to send invitations.';
  END IF;

  -- 2. Upsert the invitation securely
  -- If it already exists (even if rejected), overwrite it and reset to pending
  INSERT INTO trip_invitations (trip_id, inviter_id, invitee_id, status, created_at)
  VALUES (p_trip_id, auth.uid(), p_invitee_id, 'pending', now())
  ON CONFLICT (trip_id, invitee_id) DO UPDATE 
  SET status = 'pending', 
      inviter_id = auth.uid(), 
      created_at = now();

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
