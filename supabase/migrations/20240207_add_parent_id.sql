-- Add parent_id column to link child members to their parent
ALTER TABLE trip_participants 
ADD COLUMN parent_id UUID REFERENCES trip_participants(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_trip_participants_parent_id ON trip_participants(parent_id);

-- Comment for documentation
COMMENT ON COLUMN trip_participants.parent_id IS 'Links dependent (child) members to their parent. NULL means this is a parent/independent member.';
