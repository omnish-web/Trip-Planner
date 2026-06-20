-- ============================================================
-- Patch: Add UPDATE policy for trip_notes
-- Required for the "Edit Note" feature.
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE POLICY "Note authors can edit their own notes"
ON trip_notes FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
