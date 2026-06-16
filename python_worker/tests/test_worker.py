import os
import sys
import pytest

# Add parent directory to sys.path so we can import worker
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from worker import process_ocr, process_convert, process_ai_query

def test_ocr_processing():
    args = {
        "file_path": "C:/images/test_image.png",
        "language": "eng"
    }
    result = process_ocr(args)
    
    assert "text" in result
    assert "character_count" in result
    assert "test_image.png" in result["text"]
    assert result["character_count"] > 0

def test_conversion_processing():
    args = {
        "source_path": "C:/docs/lecture.docx",
        "target_format": "pdf"
    }
    result = process_convert(args)
    
    assert "output_path" in result
    assert "output_name" in result
    assert result["format"] == "pdf"
    assert result["output_name"] == "lecture_converted.pdf"
    assert "lecture_converted.pdf" in result["output_path"]

def test_ai_query_mock_provider():
    args = {
        "provider": "mock",
        "prompt": "What is photosynthsis?",
        "api_key": ""
    }
    result = process_ai_query(args)
    
    assert "response" in result
    assert "photosynthsis" in result["response"]
    assert "API Key" in result["response"]
    assert result["model"] == "default-model"

def test_ai_query_with_key():
    args = {
        "provider": "openai",
        "prompt": "List prime numbers",
        "api_key": "sk-mock-key-value",
        "model": "gpt-4o"
    }
    result = process_ai_query(args)
    
    assert "response" in result
    assert "Direct API connection" in result["response"]
    assert result["model"] == "gpt-4o"
    assert result["cached"] is False

def test_ai_query_rate_limit(monkeypatch):
    import requests
    class MockResponse:
        status_code = 429
        text = "Rate limit exceeded"
        def json(self):
            return {"error": "Rate limit exceeded"}
        def raise_for_status(self):
            raise requests.exceptions.HTTPError("429 Client Error: Too Many Requests", response=self)

    def mock_post(*args, **kwargs):
        return MockResponse()

    monkeypatch.setattr(requests, "post", mock_post)

    args = {
        "provider": "openai",
        "prompt": "Hello",
        "api_key": "real-key-to-trigger-requests",
        "model": "gpt-4o"
    }
    result = process_ai_query(args)
    
    assert result["rate_limit"] is True
    assert "rate limit exceeded" in result["response"].lower()
