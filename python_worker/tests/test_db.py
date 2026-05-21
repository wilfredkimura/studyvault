import pytest
import os
import sqlite3
import sys

# Add parent directory to sys.path so we can import db module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import db

@pytest.fixture(autouse=True)
def setup_database():
    # Setup an in-memory database for clean, isolated test runs
    db.init_db(':memory:')

def test_database_initialization():
    conn = db.get_conn()
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row['name'] for row in cur.fetchall()]
    
    assert 'documents' in tables
    assert 'tags' in tables
    assert 'file_tags' in tables
    assert 'conversion_history' in tables
    assert 'annotations' in tables
    assert 'ai_cache' in tables
    assert 'reading_progress' in tables

def test_documents_crud_and_fts_sync():
    doc = {
        'id': 'doc-101',
        'name': 'Introduction to Algorithms.pdf',
        'type': 'pdf',
        'path': '/docs/algorithms.pdf',
        'size': 5000000,
        'hash': 'hash-abc-123',
        'content_extracted': 'Sorting algorithms like merge sort and quick sort have O(n log n) complex.'
    }
    
    # 1. Insert document
    db.add_document(doc)
    
    # Verify it exists
    docs = db.get_documents()
    assert len(docs) == 1
    assert docs[0]['id'] == 'doc-101'
    assert docs[0]['name'] == 'Introduction to Algorithms.pdf'
    
    # 2. Verify FTS5 Sync trigger
    conn = db.get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM documents_fts WHERE id = 'doc-101'")
    fts_row = cur.fetchone()
    assert fts_row is not None
    assert fts_row['name'] == doc['name']
    assert fts_row['content'] == doc['content_extracted']
    
    # 3. Test Full-Text Search MATCH query
    results = db.search_documents('merge')
    assert len(results) == 1
    assert results[0]['name'] == 'Introduction to Algorithms.pdf'

def test_documents_update_fts_sync():
    doc = {
        'id': 'doc-102',
        'name': 'Organic Chem.pdf',
        'type': 'pdf',
        'path': '/docs/chem.pdf',
        'size': 20000,
        'hash': 'hash-xyz-987',
        'content_extracted': 'Initial content.'
    }
    db.add_document(doc)
    
    # Update document in main table
    conn = db.get_conn()
    cur = conn.cursor()
    cur.execute("""
        UPDATE documents 
        SET name = 'Advanced Organic Chemistry.pdf', 
            content_extracted = 'Alkane reactions and chemical covalent bonding.'
        WHERE id = 'doc-102'
    """)
    conn.commit()
    
    # Verify FTS virtual table got updated via SQLite triggers
    cur.execute("SELECT * FROM documents_fts WHERE id = 'doc-102'")
    fts_row = cur.fetchone()
    assert fts_row['name'] == 'Advanced Organic Chemistry.pdf'
    assert fts_row['content'] == 'Alkane reactions and chemical covalent bonding.'
    
    # Verify search matches new terms
    results = db.search_documents('covalent')
    assert len(results) == 1
    assert results[0]['name'] == 'Advanced Organic Chemistry.pdf'

def test_documents_delete_fts_sync():
    doc = {
        'id': 'doc-103',
        'name': 'ToDelete.pdf',
        'type': 'pdf',
        'path': '/docs/todelete.pdf',
        'size': 10,
        'hash': 'hash-del-456',
        'content_extracted': 'Delete this study material.'
    }
    db.add_document(doc)
    
    # Delete doc
    db.delete_document('doc-103')
    
    # Verify removed from both tables
    docs = db.get_documents()
    assert len(docs) == 0
    
    conn = db.get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM documents_fts WHERE id = 'doc-103'")
    assert cur.fetchone() is None

def test_update_document_name():
    doc = {
        'id': 'doc-104',
        'name': 'Original Name.pdf',
        'type': 'pdf',
        'path': '/docs/original.pdf',
        'size': 100,
        'hash': 'hash-rename-104',
        'content_extracted': 'Study material content.'
    }
    db.add_document(doc)
    
    # Rename document
    db.update_document_name('doc-104', 'New Name.pdf')
    
    # Verify it updated in documents table
    docs = db.get_documents()
    assert len(docs) == 1
    assert docs[0]['name'] == 'New Name.pdf'
    
    # Verify it updated in FTS table
    conn = db.get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM documents_fts WHERE id = 'doc-104'")
    fts_row = cur.fetchone()
    assert fts_row is not None
    assert fts_row['name'] == 'New Name.pdf'


def test_get_all_progress():
    """Test that get_all_progress returns reading history joined with document info."""
    # Insert two documents
    doc1 = {
        'id': 'doc-p1', 'name': 'Progress Doc 1.pdf', 'type': 'pdf',
        'path': '/docs/p1.pdf', 'size': 100, 'hash': 'hash-p1',
        'content_extracted': 'Progress doc 1 content.'
    }
    doc2 = {
        'id': 'doc-p2', 'name': 'Progress Doc 2.pdf', 'type': 'pdf',
        'path': '/docs/p2.pdf', 'size': 200, 'hash': 'hash-p2',
        'content_extracted': 'Progress doc 2 content.'
    }
    db.add_document(doc1)
    db.add_document(doc2)

    # Save progress for both
    db.save_progress({'file_id': 'doc-p1', 'last_page': 5, 'scroll_position': 100.0})
    db.save_progress({'file_id': 'doc-p2', 'last_page': 12, 'scroll_position': 250.5})

    # Query all progress
    all_prog = db.get_all_progress()
    assert len(all_prog) == 2

    # Check file_ids
    file_ids = [p['file_id'] for p in all_prog]
    assert 'doc-p1' in file_ids
    assert 'doc-p2' in file_ids

    # Check joined columns
    p1_row = next(p for p in all_prog if p['file_id'] == 'doc-p1')
    assert p1_row['last_page'] == 5
    assert p1_row['name'] == 'Progress Doc 1.pdf'
    assert p1_row['type'] == 'pdf'
