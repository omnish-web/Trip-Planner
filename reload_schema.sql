-- Reload PostgREST schema cache
-- This forces the API to recognize the new foreign key relationships
NOTIFY pgrst, 'reload schema';
