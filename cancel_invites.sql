-- This query will list all pending invitations
SELECT * FROM trip_invitations;

-- To delete all pending invitations, run:
DELETE FROM trip_invitations WHERE status = 'pending';
