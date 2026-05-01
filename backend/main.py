"""
FastAPI Backend Application Entrypoint.

This module sets up the FastAPI application, configures CORS, initializes the Redis client,
and defines all REST API endpoints for session management, file operations, and AI querying.
"""

import os
import shutil
import json
import time
import logging
from typing import Optional, List, Dict, Any

import redis
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from qdrant_client.http import models
from dotenv import load_dotenv

from ingestion import process_pdf_background
from query import process_chat_query_stream
from database import client, COLLECTION_NAME

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = FastAPI(title="DocMind AI Intelligence Platform", version="1.0.0")

# ==========================================
# 1. Configuration & Middleware
# ==========================================

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_kwargs: Dict[str, Any] = {"decode_responses": True}

if REDIS_URL.startswith("rediss://"):
    redis_kwargs["ssl_cert_reqs"] = "none"

try:
    redis_client = redis.from_url(REDIS_URL, **redis_kwargs)
except Exception as e:
    logger.error(f"Failed to connect to Redis: {e}")
    raise RuntimeError("Redis connection failed.")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ==========================================
# 2. Pydantic Schemas
# ==========================================

class QueryRequest(BaseModel):
    """Schema for the streaming query endpoint."""
    query: str = Field(..., description="The user's question or prompt.")
    session_id: str = Field(..., description="Unique identifier for the chat session.")
    selected_files: Optional[List[str]] = Field(default_factory=list, description="List of specific filenames to query. Empty means all files.")

# ==========================================
# 3. API Endpoints: Session Management
# ==========================================

@app.get("/api/sessions", response_model=List[Dict[str, Any]])
async def get_sessions() -> List[Dict[str, Any]]:
    """Retrieve all active chat sessions, sorted by creation date."""
    sessions_data = redis_client.hgetall("docmind:sessions")
    sessions = [json.loads(session) for session in sessions_data.values()]
    return sorted(sessions, key=lambda x: x.get('created_at', 0), reverse=True)

@app.post("/api/sessions", response_model=Dict[str, Any])
async def create_session() -> Dict[str, Any]:
    """Initialize and persist a new chat session."""
    session_id = f"sid_{int(time.time() * 1000)}"
    new_session = {
        "id": session_id,
        "title": "New Conversation",
        "created_at": time.time()
    }
    redis_client.hset("docmind:sessions", session_id, json.dumps(new_session))
    return new_session

@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str) -> Dict[str, str]:
    """Delete a specific session and its associated chat history."""
    redis_client.hdel("docmind:sessions", session_id)
    redis_client.delete(f"docmind:recent:{session_id}")
    redis_client.delete(f"docmind:summary:{session_id}")
    return {"status": "success", "message": f"Session {session_id} deleted."}

@app.get("/api/history/{session_id}")
async def get_history(session_id: str) -> List[Dict[str, Any]]:
    """Retrieve the recent message history for a given session."""
    history_raw = redis_client.get(f"docmind:recent:{session_id}")
    return json.loads(history_raw) if history_raw else []

# ==========================================
# 4. API Endpoints: Document Management
# ==========================================

@app.get("/api/files")
async def get_uploaded_files() -> Dict[str, List[str]]:
    """Retrieve a list of all fully ingested files available for querying."""
    files = redis_client.smembers("docmind:files_registry")
    return {"files": sorted(list(files))}

@app.post("/api/upload")
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...)) -> Dict[str, str]:
    """Upload a PDF document and trigger background ingestion processing."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Unsupported file format. Only PDFs are allowed.")
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Register file tentatively for UI awareness
        redis_client.sadd("docmind:files_registry", file.filename)
        
        # Dispatch long-running ingestion task to background worker
        background_tasks.add_task(process_pdf_background, file_path, file.filename)
        
        return {"status": "success", "filename": file.filename}
        
    except Exception as e:
        logger.error(f"Failed to upload file {file.filename}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during file upload.")

@app.get("/api/upload/status/{filename}")
async def get_upload_status(filename: str) -> Dict[str, Any]:
    """Poll the current background ingestion progress for a specific file."""
    progress_raw = redis_client.get(f"docmind:progress:{filename}")
    if progress_raw:
        return json.loads(progress_raw)
    return {"stage": "pending", "progress": 0, "message": "Awaiting processing..."}

@app.delete("/api/files/{filename}")
async def delete_file(filename: str) -> Dict[str, str]:
    """Remove a document from the vector database, Redis registry, and UI."""
    try:
        # Flag any ongoing background tasks to gracefully abort
        redis_client.set(f"docmind:cancel:{filename}", "1", ex=3600)
        
        # Remove from the global file registry
        redis_client.srem("docmind:files_registry", filename)
        
        # Issue vector deletion command to Qdrant based on metadata source
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=models.Filter(
                must=[models.FieldCondition(key="metadata.source", match=models.MatchValue(value=filename))]
            )
        )
        return {"status": "success", "message": f"File {filename} completely removed."}
        
    except Exception as e:
        logger.error(f"Failed to delete file {filename}: {e}")
        raise HTTPException(status_code=500, detail="Failed to purge document from vector store.")

# ==========================================
# 5. API Endpoints: Core AI Query Engine
# ==========================================

@app.post("/api/query")
async def ask_question(request: QueryRequest) -> StreamingResponse:
    """Stream an AI-generated response based on vector search context."""
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