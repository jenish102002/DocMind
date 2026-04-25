import os
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

def process_pdf_background(file_path: str, filename: str):
    """
    Background task to process the PDF and store it in Qdrant.
    The metadata is flattened so LangChain can correctly index it 
    for the 'metadata.source' query filter.
    """
    try:
        print(f"--- [INGESTION START] Processing: {filename} ---")
        
        # 1. Extract Text using PyMuPDF
        doc = pymupdf.open(file_path)
        full_text = ""
        for page in doc:
            full_text += page.get_text("text")
            
        # 2. Chunk the text
        # Overlap helps maintain context between chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=700,
            chunk_overlap=100,
            separators=["\n\n", "\n", ".", " ", ""]
        )
        chunks = text_splitter.split_text(full_text)
        
        # 3. FIXED: Flattened metadata
        # LangChain's QdrantVectorStore will automatically put these inside a 'metadata' field.
        metadatas = [
            {
                "source": filename, 
                "chunk_index": i
            } for i in range(len(chunks))
        ]
        
        # 4. Generate Embeddings and Store in Qdrant
        vector_store = QdrantVectorStore(
            client=client,
            collection_name=COLLECTION_NAME,
            embedding=embeddings,
        )
        
        # add_texts handles the embedding and the insertion into Qdrant
        vector_store.add_texts(texts=chunks, metadatas=metadatas)
        
        # 5. Register the file in Redis for the Frontend Sidebar
        # This makes the file appear in your 'Knowledge Base' list
        redis_client.sadd("docmind:files_registry", filename)
        
        print(f"--- [INGESTION SUCCESS] {len(chunks)} chunks embedded for {filename} ---")
        
    except Exception as e:
        print(f"--- [INGESTION ERROR] {filename}: {str(e)} ---")
    finally:
        # Clean up the temporary file from the server disk to save space
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"Temporary file {filename} removed from disk.")