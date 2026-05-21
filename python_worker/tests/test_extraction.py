import os
import sys
import tempfile
import pytest
from unittest.mock import patch, MagicMock

# Add parent directory to sys.path so we can import extractor and db
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import extractor
import db

def test_extract_text_file():
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False, mode="w", encoding="utf-8") as temp_file:
        temp_file.write("Hello StudyVault text extraction!")
        temp_file_path = temp_file.name
        
    try:
        text, file_hash = extractor.extract_text_and_hash(temp_file_path, "txt")
        assert "Hello StudyVault" in text
        assert file_hash != "empty_hash"
        # Test file hashing correctness
        import hashlib
        expected_hash = hashlib.sha256("Hello StudyVault text extraction!".encode('utf-8')).hexdigest()
        assert file_hash == expected_hash
    finally:
        os.remove(temp_file_path)

def test_db_duplicate_document_constraint():
    # Initialize clean in-memory database
    db.init_db(':memory:')
    
    # Create two temp files with identical content (will result in identical hash)
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False, mode="w", encoding="utf-8") as f1:
        f1.write("identical content")
        p1 = f1.name
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False, mode="w", encoding="utf-8") as f2:
        f2.write("identical content")
        p2 = f2.name
        
    try:
        doc1 = {"id": "d1", "name": "f1.txt", "type": "txt", "path": p1, "size": 17}
        doc2 = {"id": "d2", "name": "f2.txt", "type": "txt", "path": p2, "size": 17}
        
        # Adding first document should succeed
        assert db.add_document(doc1) is True
        
        # Adding second document with duplicate hash should raise ValueError
        with pytest.raises(ValueError) as excinfo:
            db.add_document(doc2)
        assert "Duplicate document" in str(excinfo.value)
    finally:
        os.remove(p1)
        os.remove(p2)

@patch("extractor.pdfplumber")
@patch("extractor.extract_pdf_ocr")
def test_pdf_ocr_fallback(mock_ocr, mock_pdfplumber):
    # Setup mock_pdfplumber to return no text (simulates a scanned image-only PDF)
    mock_pdf = MagicMock()
    mock_page = MagicMock()
    mock_page.extract_text.return_value = "   " # Whitespace only
    mock_pdf.pages = [mock_page]
    mock_pdfplumber.open.return_value.__enter__.return_value = mock_pdf
    
    mock_ocr.return_value = "--- Page 1 (OCR) ---\nOCR Scanned Content Output"
    
    result = extractor.extract_pdf("mock_scanned.pdf")
    assert result == "--- Page 1 (OCR) ---\nOCR Scanned Content Output"
    mock_ocr.assert_called_once_with("mock_scanned.pdf")
