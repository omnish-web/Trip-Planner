
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'categories') THEN
        ALTER TABLE trips ADD COLUMN categories TEXT[] DEFAULT ARRAY['Food', 'Transport', 'Accommodation', 'Entertainment', 'Other'];
    END IF;
END $$;
