
-- Allow Trip Deletion
-- Only owners should be able to delete a trip.

create policy "Trip owners can delete." on trips for delete using (
  auth.uid() = created_by
);
