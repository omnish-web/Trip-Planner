-- Enable Supabase Realtime for collaborative tables
-- This allows the frontend to listen to INSERT, UPDATE, and DELETE events

begin;

-- Create the publication if it doesn't exist (Supabase creates it by default, but just in case)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;

-- Add all collaborative trip tables to the realtime publication
alter publication supabase_realtime add table trips;
alter publication supabase_realtime add table trip_participants;
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table expense_splits;
alter publication supabase_realtime add table trip_notes;
alter publication supabase_realtime add table trip_note_attachments;

commit;
