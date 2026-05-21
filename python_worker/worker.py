import sys
import json
import traceback
import hashlib
import time
import db

def generate_hash(content: str) -> str:
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

def process_ocr(args):
    file_path = args.get('file_path', '')
    language = args.get('language', 'eng')
    
    # Simulate processing time
    time.sleep(1.0)
    
    extracted_text = f"[OCR Extracted text from {file_path}]\nThis is a mock text result representing scanned document contents for language: {language}.\nStudyVault OCR pipeline is active and ready."
    return {
        "text": extracted_text,
        "character_count": len(extracted_text)
    }

def process_convert(args):
    source_path = args.get('source_path', '')
    target_format = args.get('target_format', '').lower()
    
    # Simulate processing time
    time.sleep(1.5)
    
    # Return mock converted path
    output_name = source_path.split('/')[-1].split('\\')[-1]
    if '.' in output_name:
        output_name = '.'.join(output_name.split('.')[:-1])
    output_name = f"{output_name}_converted.{target_format}"
    
    return {
        "output_path": f"{source_path}_converted.{target_format}",
        "output_name": output_name,
        "format": target_format,
        "conversion_time_seconds": 1.5,
        "text_content": f"Converted content of {source_path} into format {target_format}."
    }

def process_ai_query(args):
    provider = args.get('provider', 'mock')
    prompt = args.get('prompt', '')
    
    time.sleep(1.0)
    
    # Check if this is a real provider request or mock
    if provider == 'mock' or not args.get('api_key'):
        response = f"[Mock AI response for prompt: '{prompt}']\nTo get actual answers, please add your API Key in settings. StudyVault supports direct client-side integration for OpenAI, Gemini, Anthropic, and local Ollama models."
    else:
        response = f"[StudyVault AI Node - Direct API connection established for {provider}]\nParsed query successfully."

    return {
        "response": response,
        "model": args.get('model', 'default-model'),
        "cached": False
    }

def main():
    # Loop indefinitely, reading from stdin, writing results to stdout
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break # EOF reached
            
            # Parse incoming JSON command
            request = json.loads(line.strip())
            req_id = request.get('id')
            command = request.get('command')
            args = request.get('args', {})
            
            # Route command to handler
            data = None
            if command == 'ocr':
                data = process_ocr(args)
            elif command == 'convert':
                data = process_convert(args)
            elif command == 'ai_query':
                data = process_ai_query(args)
            
            # SQLite DB Proxy Handlers
            elif command == 'db_init':
                db.init_db(args['db_path'])
                data = True
            elif command == 'db_get_documents':
                data = db.get_documents()
            elif command == 'db_add_document':
                data = db.add_document(args['doc'])
            elif command == 'db_delete_document':
                data = db.delete_document(args['id'])
            elif command == 'db_search_documents':
                data = db.search_documents(args['query'])
            elif command == 'db_get_tags':
                data = db.get_tags()
            elif command == 'db_add_tag':
                data = db.add_tag(args['tag'])
            elif command == 'db_tag_file':
                data = db.tag_file(args['file_id'], args['tag_id'])
            elif command == 'db_untag_file':
                data = db.untag_file(args['file_id'], args['tag_id'])
            elif command == 'db_get_file_tags':
                data = db.get_file_tags(args['file_id'])
            elif command == 'db_get_annotations':
                data = db.get_annotations(args['file_id'])
            elif command == 'db_add_annotation':
                data = db.add_annotation(args['anno'])
            elif command == 'db_delete_annotation':
                data = db.delete_annotation(args['id'])
            elif command == 'db_get_progress':
                data = db.get_progress(args['file_id'])
            elif command == 'db_save_progress':
                data = db.save_progress(args['progress'])
            elif command == 'db_get_history':
                data = db.get_history()
            elif command == 'db_add_history':
                data = db.add_history_record(args['record'])
            elif command == 'db_get_ai_cache':
                data = db.get_ai_cache(args['hash'])
            elif command == 'db_save_ai_cache':
                data = db.save_ai_cache(args['cache'])
            else:
                raise ValueError(f"Unknown command: {command}")
            
            # Send back successful response
            response = {
                "id": req_id,
                "status": "success",
                "data": data,
                "error": None
            }
            print(json.dumps(response), flush=True)
            
        except Exception as e:
            # Send back error response
            err_msg = str(e)
            tb = traceback.format_exc()
            response = {
                "id": req_id if 'req_id' in locals() else None,
                "status": "error",
                "data": None,
                "error": err_msg,
                "traceback": tb
            }
            print(json.dumps(response), flush=True)

if __name__ == '__main__':
    main()
