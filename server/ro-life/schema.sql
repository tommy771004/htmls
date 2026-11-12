-- 282 仙境人生 RO LIFE：帳號（Google／LINE 登入）與雲端存檔。
-- 連線字串用 RO_DATABASE_URL。每張表都加 ro_ 前綴、不動其他表，所以就算和青雀等作品放在同一個資料庫也不衝突。
-- 欄位命名參考 rAthena 官方 main.sql（login、char、inventory），改寫成 PostgreSQL：
--   * 沒有密碼欄位：帳號只能用第三方登入建立，身分記在 ro_login_identity。
--   * 存檔以 ro_save.doc（jsonb）為準；ro_char、ro_inventory 是每次存檔時一起改寫的投影，方便查詢，不會反向寫回存檔。
-- 套用：psql "$RO_DATABASE_URL" -f server/ro-life/schema.sql（可重複執行，只會建立還沒有的表）

-- 帳號（對應 rAthena login）
CREATE TABLE IF NOT EXISTS ro_login (
  account_id      bigint GENERATED ALWAYS AS IDENTITY (START WITH 2000000) PRIMARY KEY,
  userid          text NOT NULL,                       -- 顯示名稱，取自第三方帳號，可重複
  sex             char(1) NOT NULL DEFAULT 'U' CHECK (sex IN ('M', 'F', 'U')),
  group_id        smallint NOT NULL DEFAULT 0,
  state           integer NOT NULL DEFAULT 0,          -- 0 正常；其他值視為停權
  unban_time      timestamptz,                         -- 暫時停權到這個時間
  logincount      integer NOT NULL DEFAULT 0,
  lastlogin       timestamptz,
  character_slots smallint NOT NULL DEFAULT 9,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 第三方登入身分：同一個帳號可以綁 Google 與 LINE
CREATE TABLE IF NOT EXISTS ro_login_identity (
  provider     text NOT NULL CHECK (provider IN ('google', 'line')),
  subject      text NOT NULL,                          -- id_token 的 sub
  account_id   bigint NOT NULL REFERENCES ro_login ON DELETE CASCADE,
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_login   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject)
);
CREATE INDEX IF NOT EXISTS ro_login_identity_account ON ro_login_identity (account_id);

-- 登入工作階段：只存權杖的 SHA-256
CREATE TABLE IF NOT EXISTS ro_session (
  token_hash text PRIMARY KEY,
  account_id bigint NOT NULL REFERENCES ro_login ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ro_session_expires ON ro_session (expires_at);

-- OAuth 進行中的 state（PKCE verifier、nonce）與登入後換權杖用的一次性代碼，幾分鐘就過期
CREATE TABLE IF NOT EXISTS ro_auth_state (
  id         text PRIMARY KEY,
  kind       text NOT NULL CHECK (kind IN ('state', 'code')),
  provider   text NOT NULL,
  verifier   text,
  nonce      text,
  return_to  text,
  account_id bigint REFERENCES ro_login ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

-- 雲端存檔：引擎存檔用的 key → 字串（characters.v1、account.v1…），rev 做樂觀鎖
CREATE TABLE IF NOT EXISTS ro_save (
  account_id bigint PRIMARY KEY REFERENCES ro_login ON DELETE CASCADE,
  doc        jsonb NOT NULL,
  rev        bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 角色（對應 rAthena char），由 characters.v1 投影
CREATE TABLE IF NOT EXISTS ro_char (
  char_id       bigint GENERATED ALWAYS AS IDENTITY (START WITH 150000) PRIMARY KEY,
  account_id    bigint NOT NULL REFERENCES ro_login ON DELETE CASCADE,
  game_id       text NOT NULL,                         -- 引擎裡的角色 id
  char_num      smallint NOT NULL DEFAULT 0,
  name          text NOT NULL,
  class         text NOT NULL,                         -- 職業 id（knight、high_priest…）
  base_level    smallint NOT NULL DEFAULT 1,
  job_level     smallint NOT NULL DEFAULT 1,
  base_exp      bigint NOT NULL DEFAULT 0,
  job_exp       bigint NOT NULL DEFAULT 0,
  str           smallint NOT NULL DEFAULT 1,
  agi           smallint NOT NULL DEFAULT 1,
  vit           smallint NOT NULL DEFAULT 1,
  "int"         smallint NOT NULL DEFAULT 1,
  dex           smallint NOT NULL DEFAULT 1,
  luk           smallint NOT NULL DEFAULT 1,
  sex           char(1) NOT NULL DEFAULT 'M',
  hair          smallint NOT NULL DEFAULT 0,
  hair_color    smallint NOT NULL DEFAULT 0,
  clothes_color smallint NOT NULL DEFAULT 0,
  created_at    timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, game_id)
);

-- 物品（對應 rAthena inventory／storage）：本作的背包屬於帳號，所以用 account_id；裝備中的物品記下角色與欄位
CREATE TABLE IF NOT EXISTS ro_inventory (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id   bigint NOT NULL REFERENCES ro_login ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('equip', 'card', 'material')),
  uid          text,                                   -- 引擎裡的物品 uid（卡片、材料沒有）
  nameid       integer NOT NULL,                       -- 物品 id（同 rAthena item_db）
  amount       integer NOT NULL DEFAULT 1,
  refine       smallint NOT NULL DEFAULT 0,
  card0        integer,
  card1        integer,
  card2        integer,
  card3        integer,
  quality      smallint,
  tier         smallint,
  ilvl         smallint,
  affixes      jsonb,
  bound_char   text,                                   -- 綁定角色的 game_id
  char_id      bigint REFERENCES ro_char ON DELETE SET NULL, -- 正在裝備這件的角色
  equip        text                                    -- 裝備欄位（weapon、head_top…）
);
CREATE INDEX IF NOT EXISTS ro_inventory_account ON ro_inventory (account_id);

-- ===== 線上角色（server/ro-life/game.mjs）=====
-- 線上角色從 Lv1 練起、由伺服器把關，存檔和上面單機的雲端備份（ro_save）分開。套用後在 Vercel 設 RO_ONLINE=1 才會開放。
CREATE TABLE IF NOT EXISTS ro_game_save (
  account_id bigint PRIMARY KEY REFERENCES ro_login ON DELETE CASCADE,
  doc        jsonb NOT NULL,
  rev        bigint NOT NULL DEFAULT 0,
  wid        text,                                     -- 最後一次寫入的編號（用戶端產生，回應遺失時用來認出自己的寫入）
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 關卡憑證：開打時 POST run 發出，結算存檔時帶回來領取（每張只能領一次）；7 天前的自動清掉
CREATE TABLE IF NOT EXISTS ro_game_run (
  id         text PRIMARY KEY,
  account_id bigint NOT NULL REFERENCES ro_login ON DELETE CASCADE,
  stage      text NOT NULL,
  mult       real NOT NULL DEFAULT 1,
  skip       boolean NOT NULL DEFAULT false,
  char       text,
  issued_at  timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz
);
CREATE INDEX IF NOT EXISTS ro_game_run_account ON ro_game_run (account_id, issued_at);

-- 線上存檔的紀錄：每次存檔和上一版比對，記下等級、經驗、物品的變化與疑點（flags），第二步的驗證規則依這些資料訂
CREATE TABLE IF NOT EXISTS ro_game_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id bigint NOT NULL REFERENCES ro_login ON DELETE CASCADE,
  at         timestamptz NOT NULL DEFAULT now(),
  kind       text NOT NULL,                            -- save／run
  rev        bigint,
  run_id     text,
  flags      text[] NOT NULL DEFAULT '{}',             -- gain-no-claim、new-high、big-jump、dev、claim-reused…
  detail     jsonb
);
CREATE INDEX IF NOT EXISTS ro_game_log_account ON ro_game_log (account_id, at DESC);
CREATE INDEX IF NOT EXISTS ro_game_log_flagged ON ro_game_log (at DESC) WHERE flags <> '{}';

-- 無盡之塔（endless.mjs）：每場的開局快照、種子與狀態；操作分段存在 ro_endless_chunk。
-- 結束後 status = pending，擁有者電腦上的 games/282-ro-life/tools/verify-endless.mjs 用同一版頁面重跑，
-- 改成 verified（加塔的點數、上排行榜）／unranked（重跑對不上、技能不合法、比牆鐘快太多）；empty 是沒玩就結束；cheat 保留給人工判定。
CREATE TABLE IF NOT EXISTS ro_endless_run (
  id          text PRIMARY KEY,
  account_id  bigint NOT NULL REFERENCES ro_login ON DELETE CASCADE,
  char_id     text NOT NULL,
  build       text NOT NULL,                           -- 頁面的 build 編號（打包結果的雜湊），驗證時找回同一版
  engine      int,
  seed        bigint NOT NULL,
  wave        int NOT NULL DEFAULT 1,
  last        int NOT NULL,                            -- 開局時已開放的樓層數
  snapshot    jsonb NOT NULL,                          -- 開局時伺服器存檔裡的角色（含塔的強化與技能）
  season      text NOT NULL,                           -- YYYY-MM（UTC）
  name        text,
  job         text,
  state       text NOT NULL DEFAULT 'live',            -- live／suspended／ended
  status      text,                                    -- pending／empty／verified／unranked（／cheat 人工）
  ticks       int NOT NULL DEFAULT 0,
  checks      int NOT NULL DEFAULT 0,
  picks       jsonb NOT NULL DEFAULT '[]',
  claim       jsonb,                                   -- 用戶端自報的樓層與分數（只顯示用，排行榜用重跑的結果）
  cut         int,                                     -- 存起來時的接續點（格數）
  resumed     boolean NOT NULL DEFAULT false,
  started_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  verified_at timestamptz,
  verdict     jsonb,
  score       int,
  floor       int
);
CREATE INDEX IF NOT EXISTS ro_endless_run_account ON ro_endless_run (account_id, started_at DESC);
CREATE INDEX IF NOT EXISTS ro_endless_run_pending ON ro_endless_run (updated_at) WHERE status = 'pending' OR state = 'live';
CREATE INDEX IF NOT EXISTS ro_endless_run_ladder ON ro_endless_run (season, job, score DESC) WHERE status = 'verified';

CREATE TABLE IF NOT EXISTS ro_endless_chunk (
  seq        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id     text NOT NULL REFERENCES ro_endless_run ON DELETE CASCADE,
  at         int NOT NULL,                             -- 這段第一格
  runs       jsonb NOT NULL,                           -- 操作（dx, dy, 連續格數）…
  from_check int NOT NULL,
  checks     jsonb NOT NULL                            -- 每 30 格一個狀態雜湊
);
CREATE INDEX IF NOT EXISTS ro_endless_chunk_run ON ro_endless_chunk (run_id, seq);

-- 塔的進度（點數、強化、帶進塔的技能、最高樓層）：只有伺服器能改，點數由驗證程式加
CREATE TABLE IF NOT EXISTS ro_endless_progress (
  account_id bigint NOT NULL REFERENCES ro_login ON DELETE CASCADE,
  char_id    text NOT NULL,
  data       jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, char_id)
);

-- 信箱（引擎原本的郵差信箱）：市場的收款、到期退回，以及之後的系統通知與補償。ref 讓同一件事只寄一次
CREATE TABLE IF NOT EXISTS ro_game_mail (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id bigint NOT NULL REFERENCES ro_login ON DELETE CASCADE,
  kind       text NOT NULL DEFAULT 'notice' CHECK (kind IN ('notice', 'gift', 'recovered')),
  title      jsonb NOT NULL,                           -- {es, en, zh}
  body       jsonb NOT NULL,                           -- {es, en, zh}
  attach     jsonb,                                    -- {gear:[物品], cards:{id:n}, ores:{id:n}, kafra}
  ref        text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at    timestamptz,
  claimed_at timestamptz,
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS ro_game_mail_account ON ro_game_mail (account_id, id DESC) WHERE deleted_at IS NULL;

-- 市場（線上角色）：上架時物品從存檔拿出來放這裡；賣出後賣家的 Kafra 用信件寄，過期或取消的物品退回
CREATE TABLE IF NOT EXISTS ro_market (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seller_id   bigint NOT NULL REFERENCES ro_login ON DELETE CASCADE,
  seller_name text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('gear', 'card', 'ore')),
  item_id     int NOT NULL,
  item        jsonb,                                   -- 裝備才有（清理過的物品）
  count       int NOT NULL CHECK (count > 0),
  price       bigint NOT NULL CHECK (price > 0),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'sold', 'cancelled', 'expired')),
  buyer_id    bigint,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  closed_at   timestamptz
);
CREATE INDEX IF NOT EXISTS ro_market_open ON ro_market (kind, price, id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS ro_market_item ON ro_market (item_id, price) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS ro_market_seller ON ro_market (seller_id, status, id DESC);
