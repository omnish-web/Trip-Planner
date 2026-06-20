-- ============================================================
-- Patch: Add UPDATE policy for trip_note_attachments
-- Required for the "Rename" feature in the File Manager.
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE POLICY "Note authors can rename their attachments"
ON trip_note_attachments FOR UPDATE
USING (
    note_id IN (
        SELECT id FROM trip_notes WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    note_id IN (
        SELECT id FROM trip_notes WHERE user_id = auth.uid()
    )
);
