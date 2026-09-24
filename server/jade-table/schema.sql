-- Only the room table owned by 青雀; does not alter other application tables.
CREATE TABLE IF NOT EXISTS jade_mahjong_rooms (
  code text PRIMARY KEY CHECK (code ~ '^[0-9]{6}$'),
  data jsonb NOT NULL,
  version bigint NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL
);
