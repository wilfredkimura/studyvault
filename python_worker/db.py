import sqlite3
import os
import json

_db_conn = None

FALLBACK_SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  path TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  hash TEXT UNIQUE NOT NULL,
  content_extracted TEXT,
  folder_name TEXT
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_tags (
  file_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (file_id, tag_id)
);

CREATE TABLE IF NOT EXISTS conversion_history (
  id TEXT PRIMARY KEY,
  source_file_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  output_file_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  operation TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page INTEGER,
  rect TEXT,
  start_offset INTEGER,
  end_offset INTEGER,
  type TEXT NOT NULL CHECK(type IN ('highlight', 'bookmark', 'note')),
  content TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS ai_cache (
  id TEXT PRIMARY KEY,
  input_hash TEXT UNIQUE NOT NULL,
  response TEXT NOT NULL,
  model TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS reading_progress (
  file_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  last_page INTEGER NOT NULL DEFAULT 1,
  scroll_position REAL NOT NULL DEFAULT 0.0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  id UNINDEXED,
  name,
  content
);

CREATE TRIGGER IF NOT EXISTS trg_documents_insert AFTER INSERT ON documents
BEGIN
  INSERT INTO documents_fts (id, name, content)
  VALUES (new.id, new.name, COALESCE(new.content_extracted, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_documents_update AFTER UPDATE ON documents
BEGIN
  UPDATE documents_fts
  SET name = new.name,
      content = COALESCE(new.content_extracted, '')
  WHERE id = new.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_documents_delete AFTER DELETE ON documents
BEGIN
  DELETE FROM documents_fts WHERE id = old.id;
END;
"""

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def init_db(db_path: str):
    global _db_conn
    
    # Ensure directory exists
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
        
    _db_conn = sqlite3.connect(db_path)
    _db_conn.row_factory = dict_factory
    _db_conn.execute("PRAGMA foreign_keys = ON")
    
    # Try reading external schema.sql
    schema = FALLBACK_SCHEMA
    schema_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database", "schema.sql")
    if os.path.exists(schema_file):
        try:
            with open(schema_file, 'r', encoding='utf-8') as f:
                schema = f.read()
        except Exception:
            pass
            
    # Initialize schema
    _db_conn.executescript(schema)
    _db_conn.commit()

    # Migration check for folder_name
    try:
        cur = _db_conn.cursor()
        cur.execute("PRAGMA table_info(documents)")
        columns = [col['name'] for col in cur.fetchall()]
        if 'folder_name' not in columns:
            _db_conn.execute("ALTER TABLE documents ADD COLUMN folder_name TEXT")
            _db_conn.commit()
    except Exception as e:
        import sys
        print(f"Failed to migrate db column folder_name: {e}", file=sys.stderr)

def get_conn():
    global _db_conn
    if _db_conn is None:
        # Default fallback in-memory or relative file
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database", "studyvault.db")
        init_db(db_path)
    return _db_conn

# DB query implementations
def get_documents():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM documents ORDER BY updated_at DESC")
    return cur.fetchall()

def add_document(doc):
    import os
    import extractor
    
    file_path = doc['path']
    if os.path.exists(file_path):
        text, file_hash = extractor.extract_text_and_hash(file_path, doc['type'])
    else:
        # Fallback for unit testing and mocks when files don't exist locally
        text = doc.get('content_extracted') or f"[Placeholder content for {doc['name']}]"
        file_hash = doc.get('hash') or f"mock_hash_{doc['id']}"
        
    conn = get_conn()
    cur = conn.cursor()
    
    # Check duplicate hash
    cur.execute("SELECT id, name FROM documents WHERE hash = ?", (file_hash,))
    dup = cur.fetchone()
    if dup:
        raise ValueError(f"Duplicate document: A file with the same content hash already exists in the database ('{dup['name']}').")
        
    cur.execute("""
        INSERT INTO documents (id, name, type, path, size, hash, content_extracted, folder_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        doc['id'], doc['name'], doc['type'], doc['path'], 
        doc['size'], file_hash, text, doc.get('folder_name')
    ))
    conn.commit()
    return True

def delete_document(doc_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    conn.commit()
    return True

def update_document_folder(doc_id, folder_name):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        UPDATE documents 
        SET folder_name = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
    """, (folder_name, doc_id))
    conn.commit()
    return True

def update_document_name(doc_id, name):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        UPDATE documents 
        SET name = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
    """, (name, doc_id))
    conn.commit()
    return True


def search_documents(query):
    conn = get_conn()
    cur = conn.cursor()
    try:
        # FTS5 Match with BM25 sorting
        # We simulate FTS5 snippet matching since Python standard sqlite3 might not have snippet() enabled on some platforms
        cur.execute("""
            SELECT d.*, snippet(documents_fts, 2, '<b>', '</b>', '...', 10) as snippet
            FROM documents_fts fts
            JOIN documents d ON d.id = fts.id
            WHERE documents_fts MATCH ?
            ORDER BY bm25(documents_fts)
        """, (query,))
        return cur.fetchall()
    except Exception:
        # Fallback simple search
        cur.execute("""
            SELECT * FROM documents 
            WHERE name LIKE ? OR content_extracted LIKE ?
        """, (f"%{query}%", f"%{query}%"))
        return cur.fetchall()

def get_tags():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM tags")
    return cur.fetchall()

def add_tag(tag):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("INSERT INTO tags (id, name, color) VALUES (?, ?, ?)", (tag['id'], tag['name'], tag['color']))
    conn.commit()
    return True

def tag_file(file_id, tag_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("INSERT OR IGNORE INTO file_tags (file_id, tag_id) VALUES (?, ?)", (file_id, tag_id))
    conn.commit()
    return True

def untag_file(file_id, tag_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?", (file_id, tag_id))
    conn.commit()
    return True

def get_file_tags(file_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT t.* FROM tags t
        JOIN file_tags ft ON ft.tag_id = t.id
        WHERE ft.file_id = ?
    """, (file_id,))
    return cur.fetchall()

def get_annotations(file_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM annotations WHERE file_id = ? ORDER BY created_at ASC", (file_id,))
    return cur.fetchall()

def add_annotation(anno):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO annotations (id, file_id, page, rect, start_offset, end_offset, type, content)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        anno['id'], anno['file_id'], anno.get('page'), anno.get('rect'),
        anno.get('start_offset'), anno.get('end_offset'), anno['type'], anno.get('content')
    ))
    conn.commit()
    return True

def delete_annotation(anno_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM annotations WHERE id = ?", (anno_id,))
    conn.commit()
    return True

def get_progress(file_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM reading_progress WHERE file_id = ?", (file_id,))
    return cur.fetchone()

def save_progress(progress):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO reading_progress (file_id, last_page, scroll_position, updated_at)
        VALUES (?, ?, ?, datetime('now', 'localtime'))
        ON CONFLICT(file_id) DO UPDATE SET
          last_page = excluded.last_page,
          scroll_position = excluded.scroll_position,
          updated_at = datetime('now', 'localtime')
    """, (progress['file_id'], progress['last_page'], progress['scroll_position']))
    conn.commit()
    return True

def get_all_progress():
    """Return reading progress for all files, joined with document metadata, sorted by most recently read."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT rp.file_id, rp.last_page, rp.scroll_position, rp.updated_at,
               d.name, d.type, d.path, d.size
        FROM reading_progress rp
        JOIN documents d ON d.id = rp.file_id
        ORDER BY rp.updated_at DESC
    """)
    return cur.fetchall()


def get_history():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT ch.*, d1.name as source_name, d2.name as output_name 
        FROM conversion_history ch
        LEFT JOIN documents d1 ON d1.id = ch.source_file_id
        LEFT JOIN documents d2 ON d2.id = ch.output_file_id
        ORDER BY ch.timestamp DESC
    """)
    return cur.fetchall()

def add_history_record(record):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO conversion_history (id, source_file_id, output_file_id, operation, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        record['id'], record.get('source_file_id'), record.get('output_file_id'),
        record['operation'], record['status'], record.get('error_message')
    ))
    conn.commit()
    return True

def get_ai_cache(input_hash):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM ai_cache WHERE input_hash = ?", (input_hash,))
    return cur.fetchone()

def save_ai_cache(cache):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT OR REPLACE INTO ai_cache (id, input_hash, response, model, timestamp)
        VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
    """, (cache['id'], cache['input_hash'], cache['response'], cache['model']))
    conn.commit()
    return True
