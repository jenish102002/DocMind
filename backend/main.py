import os
import shutil
import redis
import json
import time
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from qdrant_client.http import models
from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

# Internal Imports
from ingestion import process_pdf_background
from query import process_chat_query_stream
from database import client, COLLECTION_NAME

app = FastAPI(title="DocMind Advanced API")

# 1. PRODUCTION-READY CONFIGURATION
# Supports Upstash (rediss://), Docker (redis://redis:6379), and local (redis://localhost:6379)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_kwargs = {"decode_responses": True}
if REDIS_URL.startswith("rediss://"):
    redis_kwargs["ssl_cert_reqs"] = "none"
redis_client = redis.from_url(REDIS_URL, **redis_kwargs)

# 2. CORS: Configurable for deployment
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "DELETE"],
    allow_headers=["*"],
)

# 3. UPDATED REQUEST MODEL: Now accepts a LIST of files
class QueryRequest(BaseModel):
    query: str
    session_id: str
    selected_files: Optional[List[str]] = []

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- SESSION ENDPOINTS (Backend State Management) ---

@app.get("/api/sessions")
async def get_sessions():
    """Fetch all sessions stored in Redis."""
    sessions_data = redis_client.hgetall("docmind:sessions")
    sessions = [json.loads(v) for v in sessions_data.values()]
    # Sort by creation time, newest first
    return sorted(sessions, key=lambda x: x.get('created_at', 0), reverse=True)

@app.post("/api/sessions")
async def create_session():
    """Create a new session entirely on the backend."""
    sid = "sid_" + str(int(time.time() * 1000))
    new_session = {"id": sid, "title": "New Chat", "created_at": time.time()}
    redis_client.hset("docmind:sessions", sid, json.dumps(new_session))
    return new_session

@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete session metadata and its chat history."""
    redis_client.hdel("docmind:sessions", session_id)
    redis_client.delete(f"docmind:recent:{session_id}")
    redis_client.delete(f"docmind:summary:{session_id}")
    return {"status": "success"}

@app.get("/api/history/{session_id}")
async def get_history(session_id: str):
    """Return chat history for a given session."""
    history_raw = redis_client.get(f"docmind:recent:{session_id}") or "[]"
    return json.loads(history_raw)

# --- FILE ENDPOINTS ---

@app.get("/api/files")
async def get_uploaded_files():
    files = redis_client.smembers("docmind:files_registry")
    return {"files": sorted(list(files))}

@app.post("/api/upload")
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Add to the registry for the frontend sidebar immediately
        redis_client.sadd("docmind:files_registry", file.filename)
        
        # Process the file asynchronously
        background_tasks.add_task(process_pdf_background, file_path, file.filename)
        return {"status": "success", "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/upload/status/{filename}")
async def get_upload_status(filename: str):
    """Returns real-time ingestion progress for a file."""
    progress_raw = redis_client.get(f"docmind:progress:{filename}")
    if progress_raw:
        return json.loads(progress_raw)
    return {"stage": "pending", "progress": 0, "message": "Waiting to start..."}

@app.delete("/api/files/{filename}")
async def delete_file(filename: str):
    """Removes a file from the UI, Redis, and Qdrant Vector DB. Also cancels any active ingestion."""
    try:
        # 1. Signal background ingestion to stop
        redis_client.set(f"docmind:cancel:{filename}", "1", ex=120)
        
        # 2. Remove from Sidebar UI Registry
        redis_client.srem("docmind:files_registry", filename)
        
        # 3. Clean up progress tracking
        redis_client.delete(f"docmind:progress:{filename}")
        
        # 4. Delete all vectors in Qdrant associated with this file
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=models.Filter(
                must=[models.FieldCondition(key="metadata.source", match=models.MatchValue(value=filename))]
            )
        )
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- QUERY ENDPOINT ---

@app.post("/api/query")
async def ask_question(request: QueryRequest):
    return StreamingResponse(
        process_chat_query_stream(
            request.query, 
            request.session_id, 
            request.selected_files
        ),
        media_type="text/plain"
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)