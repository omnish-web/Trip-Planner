-- Storage RLS Policies for trip-images bucket
-- Run this in the Supabase SQL Editor

-- 1. Allow authenticated users to UPLOAD to their own folder
CREATE POLICY "Users can upload their own trip images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'trip-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 2. Allow authenticated users to UPDATE (replace) their own images
CREATE POLICY "Users can update their own trip images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'trip-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Allow authenticated users to DELETE their own images
CREATE POLICY "Users can delete their own trip images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'trip-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Allow anyone to READ/VIEW images (public bucket)
CREATE POLICY "Anyone can view trip images"
ON storage.objects FOR SELECT
USING (bucket_id = 'trip-images');
