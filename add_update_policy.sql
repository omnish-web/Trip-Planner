-- Allow Trip Updates
-- Users can update trips they created (owners)
create policy "Trip owners can update." on trips for update using (
  auth.uid() = created_by
);
