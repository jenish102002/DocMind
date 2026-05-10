"""
Document Ingestion Pipeline.

This module handles the background processing of uploaded PDF documents.
It orchestrates text extraction, semantic chunking, and vector database insertion,
while maintaining real-time progress state in Redis.
"""

import os
import json
import logging
from typing import Dict, Any

import pymupdf
import redis
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==========================================
# 1. State Management & Embeddings Setup
# ==========================================

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_kwargs: Dict[str, Any] = {"decode_responses": True}
if REDIS_URL.startswith("rediss://"):
    redis_kwargs["ssl_cert_reqs"] = "none"

redis_client = redis.from_url(REDIS_URL, **redis_kwargs)

embeddings = OpenAIEmbeddings(
    api_key=os.getenv("OPENAI_API_KEY", "dummy"),
    model=os.getenv("OPENAI_EMBEDDINGS_MODEL", "text-embedding-3-small")
)

# ==========================================
# 2. Progress Tracking Utility
# ==========================================

def _set_progress(filename: str, stage: str, progress: int, message: str, user: str = "global") -> None:
    """
    Publish ingestion progress to Redis for frontend polling.
    
    Args:
        filename: The name of the file being processed.
        stage: Current pipeline stage (e.g., 'extracting', 'chunking', 'embedding').
        progress: Integer percentage (0-100).
        message: Human-readable status update.
    """
    try:
        redis_client.set(
            f"docmind:progress:{user}:{filename}",
            json.dumps({"stage": stage, "progress": progress, "message": message}),
            ex=300  # Auto-expire after 5 minutes
        )
    except Exception as e:
        logger.warning(f"Failed to update progress for {filename}: {e}")

# ==========================================
# 3. Core Ingestion Workflow
# ==========================================

def process_pdf_background(file_path: str, stored_name: str, display_name: str, user: str) -> None:
    """
    Background task to process a PDF and populate the vector store.
    
    Workflow:
    1. Extract raw text from the PDF using PyMuPDF.
    2. Split text into manageable semantic chunks.
    3. Generate embeddings and upload to Qdrant in batches.
    4. Register the document as available in the global UI registry.
    """
    logger.info(f"--- [INGESTION START] Processing: {display_name} for user: {user} ---")
    
    def set_progress(stage: str, progress: int, message: str):
        _set_progress(display_name, stage, progress, message, user)
    
    try:
        set_progress("extracting", 10, "Extracting text from PDF...")
        
        # 1. Extract Text
        doc = pymupdf.open(file_path)
        full_text = "".join(page.get_text("text") for page in doc)
        doc.close()
        
        if not full_text.strip():
            raise ValueError("No extractable text found in the PDF.")
            
        set_progress("chunking", 25, "Splitting into semantic chunks...")
            
        # 2. Chunking Configuration
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=700,
            chunk_overlap=100,
            separators=["\n\n", "\n", ".", " ", ""]
        )
        chunks = text_splitter.split_text(full_text)
        total_chunks = len(chunks)
        
        set_progress("embedding", 30, f"Embedding 0/{total_chunks} chunks...")
        
        # 3. Prepare Metadata & Vector Store (reuse lazy-initialized store)
        metadatas = [{"source": stored_name, "chunk_index": i} for i in range(total_chunks)]
        
        from query import get_vector_store
        vector_store = get_vector_store()
        
        # 4. Batch Embedding Processing
        batch_size = 5
        for i in range(0, total_chunks, batch_size):
            # Check for user-initiated cancellation
            if redis_client.get(f"docmind:cancel:{stored_name}"):
                logger.info(f"--- [INGESTION CANCELLED] {display_name} was aborted by user. ---")
                redis_client.delete(f"docmind:cancel:{stored_name}", f"docmind:progress:{user}:{display_name}")
                return
            
            batch_end = min(i + batch_size, total_chunks)
            vector_store.add_texts(
                texts=chunks[i:batch_end],
                metadatas=metadatas[i:batch_end]
            )
            
            # Interpolate progress from 30% to 90%
            embed_progress = 30 + int((batch_end / total_chunks) * 60)
            set_progress("embedding", embed_progress, f"Embedding {batch_end}/{total_chunks} chunks...")
        
        # Final cancellation check before finalization
        if redis_client.get(f"docmind:cancel:{stored_name}"):
            redis_client.delete(f"docmind:cancel:{stored_name}", f"docmind:progress:{user}:{display_name}")
            return
        
        # 5. Finalize & Register
        redis_client.sadd(f"docmind:files:{user}", display_name)
        set_progress("complete", 100, "Ready to query!")
        logger.info(f"--- [INGESTION SUCCESS] {total_chunks} chunks embedded for {display_name} ---")
        
    except Exception as e:
        error_msg = str(e)[:100]
        _set_progress(display_name, "error", 0, f"Error: {error_msg}", user)
        logger.error(f"--- [INGESTION ERROR] {display_name}: {e} ---")
        
    finally:
        # Guarantee removal of temporary local file
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.info(f"Cleaned up temporary file: {display_name}")
            except OSError as e:
                logger.warning(f"Failed to remove temporary file {file_path}: {e}")