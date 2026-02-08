
-- Final RLS Fix: Breaking Recursion with Security Definer

-- 1. Create a secure function to check trip membership
-- SECURITY DEFINER means this runs with admin rights, bypassing RLS recursion checks
create or replace function public.is_member_of_trip(_trip_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 
    from trip_participants 
    where trip_id = _trip_id 
    and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- 2. Drop problematic policies
drop policy if exists "Trips viewable by participants." on trips;
drop policy if exists "Participants viewable by trip members." on trip_participants;
drop policy if exists "Participants viewable by self and trip members." on trip_participants;

-- 3. Apply new simplified policies using the function

-- Trips: View if I'm a member
create policy "Trips viewable by participants." on trips for select using (
  public.is_member_of_trip(id)
);

-- Participants: View if it's me OR if I'm a member of that trip
create policy "Participants viewable by trip members." on trip_participants for select using (
  user_id = auth.uid() 
  or 
  public.is_member_of_trip(trip_id)
);

-- Note: The insert policy we added earlier ("Trip owners can add members") is fine and doesn't need changing.
