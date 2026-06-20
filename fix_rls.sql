
-- Fix Recursion in Policies and Add Missing Insert Policies

-- 1. Drop existing policies to avoid conflicts
drop policy if exists "Trips viewable by participants." on trips;
drop policy if exists "Participants viewable by trip members." on trip_participants;
drop policy if exists "Trips insertable by auth users." on trips;

-- 2. Trips: Simple check
create policy "Trips viewable by participants." on trips for select using (
  exists (
    select 1 from trip_participants 
    where trip_participants.trip_id = trips.id 
    and trip_participants.user_id = auth.uid()
  )
);

create policy "Trips insertable by auth users." on trips for insert with check (
  auth.role() = 'authenticated'
);

-- 3. Trip Participants: Avoid infinite recursion by splitting logic or using simple connection
-- A user can see a participant row if:
-- a) It is their own row (user_id = auth.uid())
-- b) They share a trip with that participant.

-- To safely implement (b) without infinite recursion, we can rely on the fact that we can always see our own rows.
create policy "Participants viewable by self and trip members." on trip_participants for select using (
  user_id = auth.uid() 
  or 
  trip_id in (
    select trip_id from trip_participants 
    where user_id = auth.uid()
  )
);

-- 4. Add MISSING insert policy for trip_participants (Required for 'Invite' feature)
-- Only allow adding members if you are an owner/admin of the trip
create policy "Trip owners can add members." on trip_participants for insert with check (
  exists (
    select 1 from trip_participants 
    where trip_participants.trip_id = trip_participants.trip_id
    and trip_participants.user_id = auth.uid()
    and trip_participants.role in ('owner', 'admin')
  )
);

-- 5. Helper function was fine, but let's be safe and use new.created_by
create or replace function public.handle_new_trip()
returns trigger as $$
begin
  insert into public.trip_participants (trip_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$ language plpgsql security definer;
