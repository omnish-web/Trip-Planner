-- Enable RLS on trip_participants if not already enabled
alter table trip_participants enable row level security;

-- Policy to allow trip owners to update other participants (e.g., roles)
-- Note: usage -- "create policy if not exists" is not standard SQL, so we drop if exists to be safe or just create.
-- However, standard Supabase patterns usually just create.
-- If you need to be idempotent:
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where tablename = 'trip_participants' 
    and policyname = 'Trip owners can update participants'
  ) then
    create policy "Trip owners can update participants"
    on trip_participants for update
    using (
      exists (
        select 1 from trip_participants tp
        where tp.trip_id = trip_participants.trip_id
        and tp.user_id = auth.uid()
        and tp.role = 'owner'
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies 
    where tablename = 'trip_participants' 
    and policyname = 'Trip owners can delete participants'
  ) then
    create policy "Trip owners can delete participants"
    on trip_participants for delete
    using (
      exists (
        select 1 from trip_participants tp
        where tp.trip_id = trip_participants.trip_id
        and tp.user_id = auth.uid()
        and tp.role = 'owner'
      )
    );
  end if;
end $$;
