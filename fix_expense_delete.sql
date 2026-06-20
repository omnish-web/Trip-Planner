-- Allow trip members to delete expenses
-- Matches the insert permissions: if you are in the trip, you can manage expenses.

create policy "Expenses deletable by trip members." on expenses for delete using (
  trip_id in (select trip_id from trip_participants where user_id = auth.uid())
);
