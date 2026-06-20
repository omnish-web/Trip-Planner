-- Add card_image_url column to trips table
-- This stores the thumbnail image shown on the Dashboard trip card.
-- The existing header_image_url column is used as the Cover Image (TripDetail banner).
ALTER TABLE trips ADD COLUMN IF NOT EXISTS card_image_url text;
