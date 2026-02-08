
-- Fix Missing Participants
-- This script adds the creator as an 'owner' to any trip that has NO participants.
-- This recovers trips created when the trigger failed due to RLS issues.

insert into public.trip_participants (trip_id, user_id, role)
select id, created_by, 'owner'
from trips
where id not in (select trip_id from trip_participants);

-- Verification: Check if you can see trips now.
select * from trips;
