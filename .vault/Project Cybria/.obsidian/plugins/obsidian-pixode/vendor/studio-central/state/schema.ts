export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  path TEXT NOT NULL,
  spec_id TEXT,
  review_status TEXT NOT NULL DEFAULT 'draft',
  director_score INTEGER,
  blueprint_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_stats (
  category TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS review_queue (
  asset_id TEXT PRIMARY KEY,
  score INTEGER,
  issue_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events_mirror (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  asset_id TEXT,
  ts TEXT NOT NULL,
  payload_json TEXT
);

CREATE TABLE IF NOT EXISTS thumbnails (
  asset_id TEXT PRIMARY KEY,
  cache_path TEXT,
  content_hash TEXT
);

CREATE TABLE IF NOT EXISTS app_kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_palettes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  data_json TEXT NOT NULL,
  collection_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS palette_collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  palette_ids_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_snippets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;
