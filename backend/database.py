"""
Vector Database Initialization and Configuration.

This module sets up the Qdrant client connection and ensures that the required
collections and payload indices exist before the application starts accepting requests.
"""

import os
import logging
from typing import Optional

from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PayloadSchemaType
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# ==========================================
# 1. Qdrant Client Initialization
# ==========================================

QDRANT_URL: str = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY: Optional[str] = os.getenv("QDRANT_API_KEY", None)

try:
    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
except Exception as e:
    logger.error(f"Failed to initialize QdrantClient: {e}")
    raise RuntimeError("Qdrant connection failed.")

COLLECTION_NAME: str = "pdf_knowledge_base"

# ==========================================
# 2. Database Schema Bootstrapping
# ==========================================

def init_qdrant() -> None:
    """
    Ensure the Qdrant collection is provisioned with correct vector dimensions.
    
    Azure OpenAI's text-embedding-3-small requires a vector size of 1536.
    Additionally, a keyword payload index is created on 'metadata.source' to
    enable highly efficient file-specific document filtering during RAG.
    """
    try:
        collections_response = client.get_collections()
        collection_names = [c.name for c in collections_response.collections]
        
        if COLLECTION_NAME not in collection_names:
            logger.info(f"Provisioning new vector collection: '{COLLECTION_NAME}'...")
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=1536, distance=Distance.COSINE)
            )
            logger.info(f"Successfully created '{COLLECTION_NAME}' with 1536 dimensions.")
        else:
            logger.info(f"Vector collection '{COLLECTION_NAME}' is ready.")
        
        # Ensure metadata filtering is optimized
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="metadata.source",
            field_schema=PayloadSchemaType.KEYWORD
        )
        logger.info("Payload index on 'metadata.source' is active.")
            
    except Exception as e:
        # Ignore errors thrown if the payload index already exists
        if "already exists" not in str(e).lower():
            logger.error(f"Qdrant initialization encountered an error: {e}")

# Automatically provision the database upon module import
init_qdrant()