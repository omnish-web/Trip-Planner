-- MASTER FIX SCRIPT
-- This script consolidates all permission fixes.

-- 1. TRIP PERMISSIONS
-- Allow owners to DELETE their trips
drop policy if exists "Trip owners can delete." on trips;
create policy "Trip owners can delete." on trips for delete using (
  auth.uid() = created_by
);

-- Allow owners to UPDATE their trips (for image/title changes)
drop policy if exists "Trip owners can update." on trips;
create policy "Trip owners can update." on trips for update using (
  auth.uid() = created_by
);

-- 2. EXPENSE SPLIT PERMISSIONS
-- Allow members to insert into expense_splits (required for adding expenses)
drop policy if exists "Splits insertable by trip members." on expense_splits;
create policy "Splits insertable by trip members." on expense_splits for insert with check (
  exists (
    select 1 
    from expenses e
    join trip_participants tp on e.trip_id = tp.trip_id
    where e.id = expense_id
    and tp.user_id = auth.uid()
  )
);

-- 3. ENSURE RECURSION FIX IS PRESENT (from previous attempts)
-- Secure function to check membership without recursion loops
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

-- Apply simplified policies if not already active (safeguard)
-- We drop and recreate to ensure they are correct
drop policy if exists "Trips viewable by participants." on trips;
create policy "Trips viewable by participants." on trips for select using (
  public.is_member_of_trip(id)
);

drop policy if exists "Participants viewable by trip members." on trip_participants;
create policy "Participants viewable by trip members." on trip_participants for select using (
  user_id = auth.uid() 
  or 
  public.is_member_of_trip(trip_id)
);
