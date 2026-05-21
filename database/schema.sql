-- StudyVault SQLite Database Schema
-- Enabled for foreign keys and Full-Text Search (FTS5)

-- Enable foreign keys (needs to be run on connection too)
PRAGMA foreign_keys = ON;

-- 1. Documents Metadata Table
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- e.g., 'pdf', 'docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'txt', 'md'
  path TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  hash TEXT UNIQUE NOT NULL, -- SHA-256 for deduplication and caching
  content_extracted TEXT, -- full text content extracted for search index
  folder_name TEXT -- folder grouping
);

-- 2. Tags Table
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL -- Hex or HSL color code
);

-- 3. File-Tags Mapping Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS file_tags (
  file_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (file_id, tag_id)
);

-- 4. Conversion History Table
CREATE TABLE IF NOT EXISTS conversion_history (
  id TEXT PRIMARY KEY,
  source_file_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  output_file_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  operation TEXT NOT NULL, -- e.g., 'pdf_to_docx', 'pptx_to_pdf', 'image_ocr'
  status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 5. Annotations, Highlights and Bookmarks Table
CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page INTEGER, -- Null for non-paginated files (txt, md)
  rect TEXT, -- JSON coordinates representing bounding boxes for PDF highlight zones
  start_offset INTEGER, -- Character offset for text/markdown
  end_offset INTEGER,
  type TEXT NOT NULL CHECK(type IN ('highlight', 'bookmark', 'note')),
  content TEXT, -- Text annotation comment or note content
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 6. AI LLM Response Cache Table (BYOK Offline Caching)
CREATE TABLE IF NOT EXISTS ai_cache (
  id TEXT PRIMARY KEY,
  input_hash TEXT UNIQUE NOT NULL, -- Hash of (query + system prompt + chunk content)
  response TEXT NOT NULL,
  model TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 7. Reading Progress Tracker
CREATE TABLE IF NOT EXISTS reading_progress (
  file_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  last_page INTEGER NOT NULL DEFAULT 1,
  scroll_position REAL NOT NULL DEFAULT 0.0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- FTS5 Full-Text Search Virtual Table
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  id UNINDEXED,
  name,
  content
);

-- SQLite Triggers to keep FTS index synchronized automatically

-- Trigger on insert
CREATE TRIGGER IF NOT EXISTS trg_documents_insert AFTER INSERT ON documents
BEGIN
  INSERT INTO documents_fts (id, name, content)
  VALUES (new.id, new.name, COALESCE(new.content_extracted, ''));
END;

-- Trigger on update
CREATE TRIGGER IF NOT EXISTS trg_documents_update AFTER UPDATE ON documents
BEGIN
  UPDATE documents_fts
  SET name = new.name,
      content = COALESCE(new.content_extracted, '')
  WHERE id = new.id;
END;

-- Trigger on delete
CREATE TRIGGER IF NOT EXISTS trg_documents_delete AFTER DELETE ON documents
BEGIN
  DELETE FROM documents_fts WHERE id = old.id;
END;
