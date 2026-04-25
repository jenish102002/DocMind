import os
import json
import pymupdf
import redis
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings
from langchain_qdrant import QdrantVectorStore

# Import the existing client and collection name from your database config
from database import client, COLLECTION_NAME

# Initialize Redis to register files for the Sidebar
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_kwargs = {"decode_responses": True}
if REDIS_URL.startswith("rediss://"):
    redis_kwargs["ssl_cert_reqs"] = "none"
redis_client = redis.from_url(REDIS_URL, **redis_kwargs)

# NVIDIA nv-embed-v1 (4096 dimensions)
embeddings = NVIDIAEmbeddings(model="nvidia/nv-embed-v1")

def _set_progress(filename: str, stage: str, progress: int, message: str):
    """Publish ingestion progress to Redis for frontend polling."""
    redis_client.set(
        f"docmind:progress:{filename}",
        json.dumps({"stage": stage, "progress": progress, "message": message}),
        ex=300  # Auto-expire after 5 minutes
    )

def process_pdf_background(file_path: str, filename: str):
    """
    Background task to process the PDF and store it in Qdrant.
    Publishes progress updates to Redis at each stage.
    """
    try:
        print(f"--- [INGESTION START] Processing: {filename} ---")
        _set_progress(filename, "extracting", 10, "Extracting text from PDF...")
        
        # 1. Extract Text using PyMuPDF
        doc = pymupdf.open(file_path)
        full_text = ""
        for page in doc:
            full_text += page.get_text("text")
        
        _set_progress(filename, "chunking", 25, "Splitting into chunks...")
            
        # 2. Chunk the text
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=700,
            chunk_overlap=100,
            separators=["\n\n", "\n", ".", " ", ""]
        )
        chunks = text_splitter.split_text(full_text)
        total_chunks = len(chunks)
        
        _set_progress(filename, "embedding", 30, f"Embedding 0/{total_chunks} chunks...")
        
        # 3. Flattened metadata for LangChain
        metadatas = [
            {"source": filename, "chunk_index": i}
            for i in range(total_chunks)
        ]
        
        # 4. Embed in batches for progress tracking
        vector_store = QdrantVectorStore(
            client=client,
            collection_name=COLLECTION_NAME,
            embedding=embeddings,
        )
        
        batch_size = 5
        for i in range(0, total_chunks, batch_size):
            # Check if user cancelled (deleted) this file
            if redis_client.get(f"docmind:cancel:{filename}"):
                print(f"--- [INGESTION CANCELLED] {filename} was deleted by user ---")
                redis_client.delete(f"docmind:cancel:{filename}")
                redis_client.delete(f"docmind:progress:{filename}")
                return
            
            batch_end = min(i + batch_size, total_chunks)
            vector_store.add_texts(
                texts=chunks[i:batch_end],
                metadatas=metadatas[i:batch_end]
            )
            # Progress: 30% → 90% across embedding batches
            embed_progress = 30 + int((batch_end / total_chunks) * 60)
            _set_progress(filename, "embedding", embed_progress, f"Embedding {batch_end}/{total_chunks} chunks...")
        
        # Final cancel check before marking complete
        if redis_client.get(f"docmind:cancel:{filename}"):
            redis_client.delete(f"docmind:cancel:{filename}")
            redis_client.delete(f"docmind:progress:{filename}")
            return
        
        # 5. Register the file in Redis for the Frontend Sidebar
        redis_client.sadd("docmind:files_registry", filename)
        
        _set_progress(filename, "complete", 100, "Ready to query!")
        print(f"--- [INGESTION SUCCESS] {total_chunks} chunks embedded for {filename} ---")
        
    except Exception as e:
        _set_progress(filename, "error", 0, f"Error: {str(e)[:100]}")
        print(f"--- [INGESTION ERROR] {filename}: {str(e)} ---")
    finally:
        # Clean up the temporary file from the server disk
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"Temporary file {filename} removed from disk.")