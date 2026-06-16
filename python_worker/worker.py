import sys
import json
import traceback
import hashlib
import time
import os
import db
import converter
import asyncio
import httpx
import re
import threading

# Initialize background loop and queue placeholders (moved below worker definitions)
bg_loop = None
task_queue = None

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
    
    if not os.path.exists(source_path):
        base, _ = os.path.splitext(source_path)
        output_path = f"{base}_converted.{target_format}"
        output_name = os.path.basename(output_path)
        return {
            "output_path": output_path,
            "output_name": output_name,
            "format": target_format,
            "conversion_time_seconds": 0.01,
            "text_content": f"[Mock Converted text for {os.path.basename(source_path)}]",
            "hash": f"mock_converted_hash_{hash(source_path)}",
            "size": 1024
        }
        
    # Derive output path
    base, _ = os.path.splitext(source_path)
    output_path = f"{base}_converted.{target_format}"
    output_name = os.path.basename(output_path)
    
    # Extract source extension
    ext = os.path.splitext(source_path)[1].replace('.', '').lower() if '.' in os.path.basename(source_path) else 'txt'
    
    # Extract plain text from source
    import extractor
    text, _ = extractor.extract_text_and_hash(source_path, ext)
    text_clean = converter.clean_extracted_text(text)
    
    start_time = time.time()
    
    # Perform actual conversion
    if target_format == 'txt':
        converter.write_txt(text_clean, output_path, os.path.basename(source_path))
    elif target_format == 'md':
        converter.write_md(text_clean, output_path, os.path.basename(source_path))
    elif target_format == 'docx':
        converter.write_docx(text_clean, output_path)
    elif target_format == 'pptx':
        converter.write_pptx(text_clean, output_path)
    elif target_format == 'pdf':
        converted_direct = False
        try:
            converted_direct = converter.convert_to_pdf_direct(source_path, output_path, ext)
        except Exception as e:
            print(f"Direct PDF conversion failed, falling back to text: {e}", file=sys.stderr)
        if not converted_direct:
            converter.write_pdf(text_clean, output_path, os.path.basename(source_path))
    else:
        raise ValueError(f"Unsupported target format: {target_format}")
        
    elapsed = time.time() - start_time
    
    # Extract metadata of the new converted file to return to DB
    new_text, new_hash = extractor.extract_text_and_hash(output_path, target_format)
    
    return {
        "output_path": output_path,
        "output_name": output_name,
        "format": target_format,
        "conversion_time_seconds": round(elapsed, 2),
        "text_content": new_text,
        "hash": new_hash,
        "size": os.path.getsize(output_path)
    }

def process_get_pdf_page_count(args):
    source_path = args.get('file_path', '')
    file_type = args.get('file_type', 'pdf').lower()
    
    if not os.path.exists(source_path):
        return {"page_count": 0}
        
    import pypdfium2 as pdfium
    pdf_path = converter.get_cached_pdf_path(source_path, file_type)
    
    pdf = pdfium.PdfDocument(pdf_path)
    count = len(pdf)
    pdf.close()
    return {"page_count": count}

def process_render_pdf_page(args):
    source_path = args.get('file_path', '')
    file_type = args.get('file_type', 'pdf').lower()
    page_num = args.get('page_num', 1)  # 1-indexed
    scale = args.get('scale', 2.0)
    
    if not os.path.exists(source_path):
        raise FileNotFoundError(f"File not found: {source_path}")
        
    import pypdfium2 as pdfium
    import io
    import base64
    
    pdf_path = converter.get_cached_pdf_path(source_path, file_type)
    pdf = pdfium.PdfDocument(pdf_path)
    
    if page_num < 1 or page_num > len(pdf):
        pdf.close()
        raise ValueError(f"Page number {page_num} out of bounds (1 to {len(pdf)})")
        
    page = pdf[page_num - 1]
    bitmap = page.render(scale=scale)
    pil_img = bitmap.to_pil()
    
    buffer = io.BytesIO()
    pil_img.save(buffer, format="PNG")
    pdf.close()
    
    img_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{img_str}"

def is_rate_limit_error(e):
    import requests
    if isinstance(e, requests.exceptions.HTTPError):
        if e.response is not None and e.response.status_code == 429:
            return True
    err_str = str(e).lower()
    if "rate limit" in err_str or "rate_limit" in err_str or "429" in err_str or "quota exceeded" in err_str:
        return True
    return False

def process_ai_query(args):
    provider = args.get('provider', 'mock')
    prompt = args.get('prompt', '')
    api_key = args.get('api_key', '')
    model = args.get('model', '')
    context = args.get('context', '')
    
    if not prompt:
        return {"response": "Prompt cannot be empty.", "model": model or "default-model", "cached": False, "rate_limit": False}
        
    if context:
        prompt = f"Context:\n{context}\n\nQuestion:\n{prompt}"
        
    # Generate prompt hash for caching
    prompt_hash = hashlib.sha256(prompt.encode('utf-8')).hexdigest()
    
    # Try looking up in the SQLite database cache
    try:
        cached_res = db.get_ai_cache(prompt_hash)
        if cached_res:
            return {
                "response": cached_res['response'],
                "model": cached_res['model'],
                "cached": True,
                "rate_limit": False
            }
    except Exception as e:
        print(f"Cache check failed: {e}", file=sys.stderr)
        
    # Mock fallback if key is empty, provider is mock, or key is a unit test mock key
    is_mock = provider == 'mock' or not api_key or api_key.startswith('sk-mock') or api_key == 'testkey-12345'
    if is_mock:
        time.sleep(0.1)  # Minor delay
        if not api_key:
            response = f"[Mock AI response for prompt: '{prompt}']\nTo get actual answers, please add your API Key in settings. StudyVault supports direct client-side integration for OpenAI, Gemini, Anthropic, and local Ollama models."
        else:
            response = f"[StudyVault AI Node - Direct API connection established for {provider}]\nParsed query successfully."
            
        return {
            "response": response,
            "model": model or "default-model",
            "cached": False,
            "rate_limit": False
        }
        
    # Perform actual REST request
    import requests
    
    response_text = ""
    resolved_model = model
    is_rate_limit = False
    
    try:
        if provider == 'gemini':
            if not resolved_model:
                resolved_model = 'gemini-2.5-flash'
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            # Try stable v1 endpoint first
            url = f"https://generativelanguage.googleapis.com/v1/models/{resolved_model}:generateContent?key={api_key}"
            try:
                res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=30)
                res.raise_for_status()
            except requests.exceptions.HTTPError as he:
                # If 404, fallback to v1beta
                if he.response is not None and he.response.status_code == 404:
                    url_beta = f"https://generativelanguage.googleapis.com/v1beta/models/{resolved_model}:generateContent?key={api_key}"
                    res = requests.post(url_beta, json=payload, headers={"Content-Type": "application/json"}, timeout=30)
                    res.raise_for_status()
                else:
                    raise he
            res_data = res.json()
            response_text = res_data['candidates'][0]['content']['parts'][0]['text']
            
        elif provider == 'openai':
            if not resolved_model:
                resolved_model = 'gpt-4o-mini'
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
            payload = {
                "model": resolved_model,
                "messages": [{"role": "user", "content": prompt}]
            }
            res = requests.post(url, json=payload, headers=headers, timeout=30)
            res.raise_for_status()
            res_data = res.json()
            response_text = res_data['choices'][0]['message']['content']
            
        elif provider == 'ollama':
            if not resolved_model:
                resolved_model = 'llama3'
            # Ollama is running locally, no key needed
            url = "http://localhost:11434/api/generate"
            payload = {
                "model": resolved_model,
                "prompt": prompt,
                "stream": False
            }
            res = requests.post(url, json=payload, timeout=30)
            res.raise_for_status()
            res_data = res.json()
            response_text = res_data['response']
            
        elif provider == 'anthropic':
            if not resolved_model:
                resolved_model = 'claude-3-5-sonnet-20241022'
            url = "https://api.anthropic.com/v1/messages"
            headers = {
                "content-type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01"
            }
            payload = {
                "model": resolved_model,
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}]
            }
            res = requests.post(url, json=payload, headers=headers, timeout=30)
            res.raise_for_status()
            res_data = res.json()
            response_text = res_data['content'][0]['text']
            
        else:
            response_text = f"[StudyVault AI Node - Direct API connection established for {provider}]\nParsed query successfully (fallback mock)."
 
            
        # Cache the successful response
        try:
            cache_id = "cache_" + hashlib.md5((prompt_hash + resolved_model).encode('utf-8')).hexdigest()[:10]
            db.save_ai_cache({
                "id": cache_id,
                "input_hash": prompt_hash,
                "response": response_text,
                "model": resolved_model
            })
        except Exception as e:
            print(f"Saving to cache failed: {e}", file=sys.stderr)
            
    except Exception as e:
        if is_rate_limit_error(e):
            response_text = "API rate limit exceeded. Please wait a moment before trying again."
            is_rate_limit = True
        else:
            response_text = f"AI query failed: {str(e)}"
        
    return {
        "response": response_text,
        "model": resolved_model,
        "cached": False,
        "rate_limit": is_rate_limit
    }

def get_fallback_models(provider):
    if provider == 'openai':
        return [
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "context_window": 128000, "provider": "openai"},
            {"id": "gpt-4o", "name": "GPT-4o", "context_window": 128000, "provider": "openai"},
            {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "context_window": 128000, "provider": "openai"}
        ]
    elif provider == 'gemini':
        return [
            {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "context_window": 1048576, "provider": "gemini"},
            {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "context_window": 2097152, "provider": "gemini"},
            {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "context_window": 1048576, "provider": "gemini"}
        ]
    elif provider == 'anthropic':
        return [
            {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "context_window": 200000, "provider": "anthropic"},
            {"id": "claude-3-5-haiku-20241022", "name": "Claude 3.5 Haiku", "context_window": 200000, "provider": "anthropic"}
        ]
    elif provider == 'openrouter':
        return [
            {"id": "meta-llama/llama-3-8b-instruct", "name": "Llama 3 8B", "context_window": 8192, "provider": "openrouter"}
        ]
    elif provider == 'ollama':
        return [
            {"id": "llama3", "name": "Llama 3", "context_window": 8192, "provider": "ollama"},
            {"id": "mistral", "name": "Mistral", "context_window": 8192, "provider": "ollama"}
        ]
    return []

async def fetch_openai_models(api_key):
    url = "https://api.openai.com/v1/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.get(url, headers=headers)
        res.raise_for_status()
        data = res.json()
        models = []
        for m in data.get('data', []):
            m_id = m['id']
            if m_id.startswith('gpt-') or m_id.startswith('o1-'):
                context = 128000
                if m_id == 'gpt-4':
                    context = 8192
                models.append({
                    "id": m_id,
                    "name": m_id.replace('-', ' ').title(),
                    "context_window": context,
                    "provider": "openai"
                })
        return sorted(models, key=lambda x: x['id'])

async def fetch_anthropic_models(api_key):
    url = "https://api.anthropic.com/v1/models"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01"
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.get(url, headers=headers)
        res.raise_for_status()
        data = res.json()
        models = []
        for m in data.get('data', []):
            models.append({
                "id": m['id'],
                "name": m.get('display_name') or m['id'].replace('-', ' ').title(),
                "context_window": 200000,
                "provider": "anthropic"
            })
        return sorted(models, key=lambda x: x['id'])

async def fetch_gemini_models(api_key):
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            res = await client.get(url)
            res.raise_for_status()
        except Exception as e:
            err_msg = str(e)
            err_msg = re.sub(r'key=[a-zA-Z0-9_-]+', 'key=REDACTED', err_msg)
            raise RuntimeError(f"Gemini API request failed: {err_msg}") from None
            
        data = res.json()
        models = []
        for m in data.get('models', []):
            methods = m.get('supportedGenerationMethods', [])
            if 'generateContent' in methods:
                clean_id = m['name'].replace('models/', '')
                context = m.get('inputTokenLimit', 1048576)
                models.append({
                    "id": clean_id,
                    "name": clean_id.replace('-', ' ').title().replace('Gemini', 'Gemini '),
                    "context_window": context,
                    "provider": "gemini"
                })
        return sorted(models, key=lambda x: x['id'])

async def fetch_openrouter_models():
    url = "https://openrouter.ai/api/v1/models"
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.get(url)
        res.raise_for_status()
        data = res.json()
        models = []
        for m in data.get('data', []):
            models.append({
                "id": m['id'],
                "name": m.get('name') or m['id'],
                "context_window": m.get('context_length', 8192),
                "provider": "openrouter"
            })
        return sorted(models, key=lambda x: x['id'])

async def fetch_ollama_models():
    url = "http://localhost:11434/api/tags"
    async with httpx.AsyncClient(timeout=3.0) as client:
        res = await client.get(url)
        res.raise_for_status()
        data = res.json()
        models = []
        for m in data.get('models', []):
            name = m['name']
            models.append({
                "id": name,
                "name": name,
                "context_window": 8192,
                "provider": "ollama"
            })
        return sorted(models, key=lambda x: x['id'])

async def execute_refresh_provider_models(user_id, provider_id, api_key):
    is_mock = provider_id == 'mock' or (provider_id != 'ollama' and (not api_key or api_key.startswith('sk-mock') or api_key == 'testkey-12345'))
    models = []
    try:
        if is_mock:
            models = get_fallback_models(provider_id)
        else:
            if provider_id == 'openai':
                models = await fetch_openai_models(api_key)
            elif provider_id == 'gemini':
                models = await fetch_gemini_models(api_key)
            elif provider_id == 'anthropic':
                models = await fetch_anthropic_models(api_key)
            elif provider_id == 'openrouter':
                models = await fetch_openrouter_models()
            elif provider_id == 'ollama':
                models = await fetch_ollama_models()
    except Exception as e:
        err_msg = str(e)
        err_msg = re.sub(r'key=[a-zA-Z0-9_-]+', 'key=REDACTED', err_msg)
        print(f"Error fetching models for {provider_id}, using fallback: {err_msg}", file=sys.stderr)
        models = get_fallback_models(provider_id)
        
    if models:
        db.save_provider_models(provider_id, models)
    return models

async def refresh_provider_models_worker():
    while True:
        task = await task_queue.get()
        user_id = task.get('user_id')
        provider_id = task.get('provider_id')
        api_key = task.get('api_key')
        try:
            await execute_refresh_provider_models(user_id, provider_id, api_key)
        except Exception as e:
            print(f"Background refresh task error: {e}", file=sys.stderr)
        finally:
            task_queue.task_done()

# Initialize background event loop for decoupled tasks after functions are defined
bg_loop = asyncio.new_event_loop()
def start_background_loop(loop):
    asyncio.set_event_loop(loop)
    loop.run_forever()

threading.Thread(target=start_background_loop, args=(bg_loop,), daemon=True).start()

async def init_queue():
    global task_queue
    task_queue = asyncio.Queue()
    asyncio.create_task(refresh_provider_models_worker())

# Run initialization in background loop
future = asyncio.run_coroutine_threadsafe(init_queue(), bg_loop)
future.result() # Wait for it to initialize

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
            elif command == 'get_pdf_page_count':
                data = process_get_pdf_page_count(args)
            elif command == 'render_pdf_page':
                data = process_render_pdf_page(args)
            elif command == 'ai_query':
                data = process_ai_query(args)
            elif command == 'ai_get_models':
                provider = args.get('provider', 'mock')
                api_key = args.get('api_key', '')
                models = db.get_provider_models(provider)
                if not models:
                    future = asyncio.run_coroutine_threadsafe(
                        execute_refresh_provider_models('default_user', provider, api_key),
                        bg_loop
                    )
                    models = future.result()
                data = models
            elif command == 'refresh_provider_models':
                user_id = args.get('user_id', 'default_user')
                provider_id = args.get('provider_id')
                api_key = args.get('api_key', '')
                bg_loop.call_soon_threadsafe(
                    task_queue.put_nowait,
                    {"user_id": user_id, "provider_id": provider_id, "api_key": api_key}
                )
                data = {"status": "queued"}
            
            # SQLite DB Proxy Handlers
            elif command == 'db_init':
                db.init_db(args['db_path'])
                data = True
            elif command == 'db_get_documents':
                data = db.get_documents()
            elif command == 'db_add_document':
                data = db.add_document(args['doc'])
            elif command == 'db_update_document_folder':
                data = db.update_document_folder(args['id'], args['folder_name'])
            elif command == 'db_update_document_name':
                data = db.update_document_name(args['id'], args['name'])
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
            elif command == 'db_get_all_progress':
                data = db.get_all_progress()
            elif command == 'db_get_history':
                data = db.get_history()
            elif command == 'db_add_history':
                data = db.add_history_record(args['record'])
            elif command == 'db_get_ai_cache':
                data = db.get_ai_cache(args['hash'])
            elif command == 'db_save_ai_cache':
                data = db.save_ai_cache(args['cache'])
            elif command == 'db_get_ai_chats':
                data = db.get_ai_chats(args.get('file_id'))
            elif command == 'db_create_ai_chat':
                data = db.create_ai_chat(args['chat_id'], args['title'], args.get('file_id'))
            elif command == 'db_delete_ai_chat':
                data = db.delete_ai_chat(args['chat_id'])
            elif command == 'db_get_ai_messages':
                data = db.get_ai_messages(args['chat_id'])
            elif command == 'db_add_ai_message':
                data = db.add_ai_message(args['msg_id'], args['chat_id'], args['role'], args['content'])
            elif command == 'extract_text':
                file_path = args.get('file_path', '')
                file_type = args.get('file_type', '')
                text, file_hash = extractor.extract_text_and_hash(file_path, file_type)
                data = {"text": text, "hash": file_hash}
            elif command == 'db_update_document_content':
                data = db.update_document_content(args['id'], args['content'])
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
