"""
FastAPI Backend Application Entrypoint.

Handles CORS, Redis, and all REST API endpoints for auth, session management,
file operations, and AI querying. All data is scoped per authenticated user.
"""

import os
import shutil
import json
import time
import logging
import hashlib
from typing import Optional, List, Dict, Any

import redis
import jwt as pyjwt
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Header
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
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-docmind-key")
JWT_ALGORITHM = "HS256"

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
# 2. Auth Helpers
# ==========================================

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_token(email: str) -> str:
    from datetime import datetime, timedelta, timezone
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    return pyjwt.encode({"sub": email, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """Dependency: decode JWT from Authorization header and return email."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email: str = payload.get("sub", "")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
        return email
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==========================================
# 3. Pydantic Schemas
# ==========================================

class RegisterRequest(BaseModel):
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class QueryRequest(BaseModel):
    query: str = Field(...)
    session_id: str = Field(...)
    selected_files: Optional[List[str]] = Field(default_factory=list)

# ==========================================
# 4. Auth Endpoints
# ==========================================

@app.post("/api/auth/register")
def register_user(request: RegisterRequest):
    """Register with email and password. Instant — no OTP needed."""
    existing = redis_client.hget("docmind:users", request.email)
    if existing:
        parsed = json.loads(existing)
        # Block re-registration only if it's a fully active account (not a stale OTP-era record)
        if "created_at" in parsed:
            raise HTTPException(status_code=400, detail="An account with this email already exists. Please log in.")
        # Else: old unverified/incomplete record — allow overwrite

    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    redis_client.hset("docmind:users", request.email, json.dumps({
        "password": hash_password(request.password),
        "created_at": time.time()
    }))

    token = create_token(request.email)
    return {"status": "success", "token": token, "email": request.email}

@app.post("/api/auth/login")
def login_user(request: LoginRequest):
    """Login with email and password."""
    user_data = redis_client.hget("docmind:users", request.email)
    if not user_data:
        raise HTTPException(status_code=401, detail="No account found with this email. Please sign up.")
    
    parsed = json.loads(user_data)
    if parsed["password"] != hash_password(request.password):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    token = create_token(request.email)
    return {"status": "success", "token": token, "email": request.email}

@app.get("/api/auth/me")
def get_me(authorization: Optional[str] = Header(None)):
    """Validate the JWT and return the user's email. Used by frontend on page load."""
    user = get_current_user(authorization)
    # Also verify user still exists in the database
    user_data = redis_client.hget("docmind:users", user)
    if not user_data:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return {"email": user}

# ==========================================
# 5. Session Endpoints (per-user)
# ==========================================

@app.get("/api/sessions", response_model=List[Dict[str, Any]])
def get_sessions(authorization: Optional[str] = Header(None)) -> List[Dict[str, Any]]:
    user = get_current_user(authorization)
    sessions_data = redis_client.hgetall(f"docmind:sessions:{user}")
    sessions = [json.loads(s) for s in sessions_data.values()]  # type: ignore
    return sorted(sessions, key=lambda x: x.get("created_at", 0), reverse=True)

@app.post("/api/sessions", response_model=Dict[str, Any])
def create_session(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    user = get_current_user(authorization)
    session_id = f"sid_{int(time.time() * 1000)}"
    new_session = {"id": session_id, "title": "New Conversation", "created_at": time.time()}
    redis_client.hset(f"docmind:sessions:{user}", session_id, json.dumps(new_session))
    return new_session

@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str, authorization: Optional[str] = Header(None)) -> Dict[str, str]:
    user = get_current_user(authorization)
    redis_client.hdel(f"docmind:sessions:{user}", session_id)
    redis_client.delete(f"docmind:recent:{user}:{session_id}")
    redis_client.delete(f"docmind:summary:{user}:{session_id}")
    return {"status": "success"}

@app.get("/api/history/{session_id}")
def get_history(session_id: str, authorization: Optional[str] = Header(None)) -> List[Dict[str, Any]]:
    user = get_current_user(authorization)
    history_raw = redis_client.get(f"docmind:recent:{user}:{session_id}")
    return json.loads(history_raw) if history_raw else []  # type: ignore

# ==========================================
# 6. File / Upload Endpoints (per-user)
# ==========================================

@app.get("/api/files")
def get_uploaded_files(authorization: Optional[str] = Header(None)) -> Dict[str, List[str]]:
    user = get_current_user(authorization)
    files = redis_client.smembers(f"docmind:files:{user}")
    return {"files": sorted(list(files))}  # type: ignore

@app.post("/api/upload")
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None)
) -> Dict[str, str]:
    user = get_current_user(authorization)
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # Prefix filename with user email hash to namespace in Qdrant
    safe_user = hashlib.md5(user.encode()).hexdigest()[:8]
    stored_name = f"{safe_user}__{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, stored_name)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        redis_client.sadd(f"docmind:files:{user}", file.filename)
        background_tasks.add_task(process_pdf_background, file_path, stored_name, file.filename, user)
        return {"status": "success", "filename": file.filename}

    except Exception as e:
        logger.error(f"Upload failed for {file.filename}: {e}")
        raise HTTPException(status_code=500, detail="File upload failed.")

@app.get("/api/upload/status/{filename}")
def get_upload_status(filename: str, authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    user = get_current_user(authorization)
    progress_raw = redis_client.get(f"docmind:progress:{user}:{filename}")
    if progress_raw:
        return json.loads(progress_raw)  # type: ignore
    return {"stage": "pending", "progress": 0, "message": "Awaiting processing..."}

@app.delete("/api/files/{filename}")
def delete_file(filename: str, authorization: Optional[str] = Header(None)) -> Dict[str, str]:
    user = get_current_user(authorization)
    safe_user = hashlib.md5(user.encode()).hexdigest()[:8]
    stored_name = f"{safe_user}__{filename}"

    try:
        redis_client.set(f"docmind:cancel:{stored_name}", "1", ex=3600)
        redis_client.srem(f"docmind:files:{user}", filename)
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=models.Filter(
                must=[models.FieldCondition(key="metadata.source", match=models.MatchValue(value=stored_name))]
            )
        )
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Delete failed for {filename}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete file.")

# ==========================================
# 7. AI Query Endpoint (per-user)
# ==========================================

@app.post("/api/query")
def ask_question(request: QueryRequest, authorization: Optional[str] = Header(None)) -> StreamingResponse:
    user = get_current_user(authorization)
    safe_user = hashlib.md5(user.encode()).hexdigest()[:8]

    # Remap display filenames to stored names with user prefix
    stored_files = [f"{safe_user}__{f}" for f in request.selected_files] if request.selected_files else []

    return StreamingResponse(
        process_chat_query_stream(
            user_query=request.query,
            session_id=f"{user}:{request.session_id}",
            selected_files=stored_files if stored_files else None
        ),
        media_type="text/plain"
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)