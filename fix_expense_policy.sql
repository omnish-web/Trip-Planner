-- Allow inserting into expense_splits
-- Users can insert splits if they are members of the trip the expense belongs to.
-- Since we are inserting, we can't easily join to 'expenses' for the 'expense_id' because the row might not be visible yet or it's complex.
-- SIMPLER: Allow insert if the user is a participant of the trip that the *parent expense* belongs to.
-- But wait, in the policy check for 'insert', we have access to the 'new' row.
-- 'new.expense_id' refers to the expense.

create policy "Splits insertable by trip members." on expense_splits for insert with check (
  exists (
    select 1 
    from expenses e
    join trip_participants tp on e.trip_id = tp.trip_id
    where e.id = expense_id
    and tp.user_id = auth.uid()
  )
);
