-- 286 天堂人生 · 1.63 獨立運作平台（server/lineage-web）PostgreSQL / Neon Schema
-- 套用方式：psql "$LINEAGE_DATABASE_URL" -f server/lineage-web/schema.sql

CREATE TABLE IF NOT EXISTS "accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "username" varchar(64) NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "role" varchar(24) DEFAULT 'player' NOT NULL,
  "eggs" integer DEFAULT 0 NOT NULL,
  "is_held" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "token_hash" varchar(128) NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "sessions_account_idx" ON "sessions" ("account_id");

CREATE TABLE IF NOT EXISTS "characters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "name" varchar(32) NOT NULL UNIQUE,
  "class_id" varchar(24) NOT NULL,
  "level" integer DEFAULT 1 NOT NULL,
  "str" integer NOT NULL,
  "dex" integer NOT NULL,
  "con" integer NOT NULL,
  "wis" integer NOT NULL,
  "cha" integer NOT NULL,
  "intel" integer NOT NULL,
  "hp" integer DEFAULT 30 NOT NULL,
  "mp" integer DEFAULT 10 NOT NULL,
  "map_id" integer DEFAULT 4 NOT NULL,
  "pos_x" integer DEFAULT 32578 NOT NULL,
  "pos_y" integer DEFAULT 32943 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "characters_account_idx" ON "characters" ("account_id");

CREATE TABLE IF NOT EXISTS "forum_topics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(120) NOT NULL UNIQUE,
  "title" varchar(160) NOT NULL,
  "category" varchar(48) DEFAULT 'general' NOT NULL,
  "author_name" varchar(64) NOT NULL,
  "body" text NOT NULL,
  "pinned" boolean DEFAULT false NOT NULL,
  "likes" integer DEFAULT 0 NOT NULL,
  "reply_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "forum_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "topic_id" uuid NOT NULL REFERENCES "forum_topics"("id") ON DELETE CASCADE,
  "author_name" varchar(64) NOT NULL,
  "body" text NOT NULL,
  "likes" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "forum_posts_topic_idx" ON "forum_posts" ("topic_id");

CREATE TABLE IF NOT EXISTS "payment_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_no" varchar(64) NOT NULL UNIQUE,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "package_id" varchar(48) NOT NULL,
  "amount_twd" integer NOT NULL,
  "eggs_granted" integer NOT NULL,
  "provider" varchar(32) DEFAULT 'origin-pay' NOT NULL,
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "provider_tx_id" varchar(128),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "purchase_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idempotency_key" varchar(160) NOT NULL UNIQUE,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "product_id" varchar(80) NOT NULL,
  "purchase_token" text NOT NULL,
  "eggs_granted" integer NOT NULL,
  "status" varchar(24) DEFAULT 'verified' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "client_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" varchar(48) NOT NULL,
  "message" text NOT NULL,
  "build" varchar(32) DEFAULT '656' NOT NULL,
  "pathname" varchar(160) DEFAULT '/' NOT NULL,
  "user_agent" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "runtime_controls" (
  "key" varchar(64) PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "gm_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor" varchar(64) NOT NULL,
  "action" varchar(64) NOT NULL,
  "target" varchar(128) NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
