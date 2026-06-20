-- ============================================================
-- Migration: Expense File Attachments
-- Run this in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS attachment_name text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS attachment_type text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS attachment_size bigint;
