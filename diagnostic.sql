
-- Diagnostic Script
-- Run this to see exactly what is in your database.

-- 1. Count all trips (ignoring permissions for this query if run in SQL Editor)
select count(*) as total_trips from trips;

-- 2. List recent trips with their creator
select id, title, created_by, created_at from trips order by created_at desc limit 5;

-- 3. Check participants for those trips
select * from trip_participants where trip_id in (select id from trips order by created_at desc limit 5);

-- 4. Check your own user ID (from the context of the running query, might be null in generic editor)
-- If this returns null, manually replace `auth.uid()` with your UUID if you know it, or just rely on the above.
select auth.uid() as current_user_id;

-- 5. Force add you to the latest trip if you aren't in it (Emergency Fix)
-- This attempts to insert YOU (auth.uid) into the latest trip found.
-- ONLY RUN THIS if you are sure you are logged in as the user who should own it.
/*
insert into trip_participants (trip_id, user_id, role)
select id, auth.uid(), 'owner'
from trips
order by created_at desc
limit 1;
*/
