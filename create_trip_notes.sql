-- ============================================================
-- Migration: Day-Wise Notes & File Attachments
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. TRIP NOTES TABLE
-- Stores individual timestamped note entries per trip (the timeline feed)
CREATE TABLE IF NOT EXISTS trip_notes (
    id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    trip_id     UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
    user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL-safe for future guest support
    content     TEXT NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast per-trip queries
CREATE INDEX IF NOT EXISTS idx_trip_notes_trip_id ON trip_notes(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_notes_created_at ON trip_notes(trip_id, created_at DESC);

COMMENT ON TABLE trip_notes IS 'Chronological timeline log entries for a trip. Each row is one posted note by a participant.';
COMMENT ON COLUMN trip_notes.user_id IS 'The profile who authored this note. NULL is reserved for potential future guest/dependent authors.';


-- 2. TRIP NOTE ATTACHMENTS TABLE
-- Stores file attachments linked to a note (consistent with expense_splits pattern)
CREATE TABLE IF NOT EXISTS trip_note_attachments (
    id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    note_id     UUID REFERENCES trip_notes(id) ON DELETE CASCADE NOT NULL,
    file_name   TEXT NOT NULL,          -- original filename, e.g. "hotel_invoice.pdf"
    file_url    TEXT NOT NULL,          -- public Supabase storage URL
    file_type   TEXT NOT NULL,          -- MIME type, e.g. "application/pdf" or "image/jpeg"
    file_size   BIGINT DEFAULT 0,       -- size in bytes for display
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trip_note_attachments_note_id ON trip_note_attachments(note_id);

COMMENT ON TABLE trip_note_attachments IS 'Files (PDFs, images, docs) attached to a trip_notes entry. Mirrors the expense_splits pattern.';


-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE trip_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_note_attachments ENABLE ROW LEVEL SECURITY;


-- 4. RLS POLICIES FOR trip_notes

-- Trip participants can view all notes for their trip
CREATE POLICY "Trip notes viewable by trip participants"
ON trip_notes FOR SELECT
USING (
    trip_id IN (
        SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
    )
);

-- Any trip participant can post a note
CREATE POLICY "Trip participants can insert notes"
ON trip_notes FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND trip_id IN (
        SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
    )
);

-- Only the note author can delete their own note
CREATE POLICY "Note authors can delete their own notes"
ON trip_notes FOR DELETE
USING (auth.uid() = user_id);


-- 5. RLS POLICIES FOR trip_note_attachments

-- Viewable by anyone who can see the parent note's trip
CREATE POLICY "Attachments viewable by trip participants"
ON trip_note_attachments FOR SELECT
USING (
    note_id IN (
        SELECT id FROM trip_notes WHERE trip_id IN (
            SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
        )
    )
);

-- Insertable when inserting a note (checked via note ownership)
CREATE POLICY "Authenticated users can insert attachments for their notes"
ON trip_note_attachments FOR INSERT
WITH CHECK (
    note_id IN (
        SELECT id FROM trip_notes WHERE user_id = auth.uid()
    )
);

-- Deletable by the note author
CREATE POLICY "Attachment owners can delete attachments"
ON trip_note_attachments FOR DELETE
USING (
    note_id IN (
        SELECT id FROM trip_notes WHERE user_id = auth.uid()
    )
);


-- ============================================================
-- STORAGE BUCKET: trip-files
-- ============================================================
-- NOTE: Create the 'trip-files' bucket manually in the Supabase
-- Dashboard (Storage > New Bucket > Public: ON).
-- Then run the policies below.

-- Allow authenticated users to upload to trip-files/{trip_id}/
CREATE POLICY "Authenticated users can upload trip files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'trip-files');

-- Allow authenticated users to delete files they uploaded
CREATE POLICY "Authenticated users can delete their trip files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'trip-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow anyone to read/view files (public bucket)
CREATE POLICY "Anyone can view trip files"
ON storage.objects FOR SELECT
USING (bucket_id = 'trip-files');
