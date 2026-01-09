ALTER TABLE friendships
ADD COLUMN requester_nickname TEXT,
ADD COLUMN addressee_nickname TEXT;

COMMENT ON COLUMN friendships.requester_nickname IS 'Nickname for addressee set by requester';
COMMENT ON COLUMN friendships.addressee_nickname IS 'Nickname for requester set by addressee';
