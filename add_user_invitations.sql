-- 1. Modify profiles to add username_id (Publicly viewable)
ALTER TABLE profiles ADD COLUMN username_id text UNIQUE;

-- 2. Create user_secrets table for Passcodes (Private)
CREATE TABLE user_secrets (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  passcode text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE user_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own secrets" ON user_secrets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own secrets" ON user_secrets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own secrets" ON user_secrets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Create trip_invitations table
CREATE TABLE trip_invitations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  inviter_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  invitee_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(trip_id, invitee_id) -- Prevent duplicate invites for the same trip
);

ALTER TABLE trip_invitations ENABLE ROW LEVEL SECURITY;

-- Inviter can see invites they sent, invitee can see invites they received
CREATE POLICY "Users can view related invites" ON trip_invitations 
  FOR SELECT USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- Inviter can create an invite (must be part of the trip)
CREATE POLICY "Inviter can create invite" ON trip_invitations 
  FOR INSERT WITH CHECK (
    auth.uid() = inviter_id AND 
    EXISTS (SELECT 1 FROM trip_participants WHERE trip_id = trip_invitations.trip_id AND user_id = auth.uid())
  );

-- Invitee can update invite status (accept/reject)
CREATE POLICY "Invitee can update invite" ON trip_invitations 
  FOR UPDATE USING (auth.uid() = invitee_id);

-- Inviter can delete pending invites
CREATE POLICY "Inviter can delete invite" ON trip_invitations 
  FOR DELETE USING (auth.uid() = inviter_id AND status = 'pending');

-- 4. Function to generate random alphanumeric string
CREATE OR REPLACE FUNCTION generate_random_alphanumeric(length integer) RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 5. Backfill existing users
DO $$
DECLARE
  rec RECORD;
  new_username text;
  new_passcode text;
BEGIN
  FOR rec IN SELECT id FROM profiles WHERE username_id IS NULL LOOP
    -- Generate unique username_id (6 chars)
    LOOP
      new_username := generate_random_alphanumeric(6);
      BEGIN
        UPDATE profiles SET username_id = new_username WHERE id = rec.id;
        EXIT; -- Success, exit loop
      EXCEPTION WHEN unique_violation THEN
        -- Retry if collision
      END;
    END LOOP;
    
    -- Generate passcode (6 chars) and insert into user_secrets
    new_passcode := generate_random_alphanumeric(6);
    INSERT INTO user_secrets (user_id, passcode) VALUES (rec.id, new_passcode) ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- 6. Update trigger for new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_username text;
  new_passcode text;
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  
  -- Generate unique username_id
  LOOP
    new_username := generate_random_alphanumeric(6);
    BEGIN
      UPDATE public.profiles SET username_id = new_username WHERE id = new.id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- loop again
    END;
  END LOOP;

  -- Generate passcode
  new_passcode := generate_random_alphanumeric(6);
  INSERT INTO public.user_secrets (user_id, passcode) VALUES (new.id, new_passcode);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Direct Add RPC (Security Definer to bypass RLS for inserting participant)
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

  -- Insert into trip_participants
  INSERT INTO trip_participants (trip_id, user_id, role) VALUES (p_trip_id, v_user_id, 'member');

  RETURN json_build_object('success', true, 'user_id', v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
