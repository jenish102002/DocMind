import os
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams
from dotenv import load_dotenv

load_dotenv()

# Connect to Qdrant (local Docker or Qdrant Cloud)
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", None)
client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
COLLECTION_NAME = "pdf_knowledge_base"


def init_qdrant():
    """
    Initializes the Qdrant collection with the correct vector dimensions.
    NVIDIA nv-embed-v1 requires a vector size of 4096.
    Also creates a payload index for filtered search (required by Qdrant Cloud).
    """
    from qdrant_client.http.models import PayloadSchemaType
    try:
        collections = client.get_collections().collections
        collection_names = [c.name for c in collections]
        
        if COLLECTION_NAME not in collection_names:
            print(f"Creating collection '{COLLECTION_NAME}'...")
            client.create_collection(
                collection_name=COLLECTION_NAME,
                # Size 4096 is required for nvidia/nv-embed-v1
                vectors_config=VectorParams(size=4096, distance=Distance.COSINE)
            )
            print(f"✅ Collection '{COLLECTION_NAME}' created with 4096 dimensions.")
        else:
            print(f"ℹ️ Collection '{COLLECTION_NAME}' already exists and is ready.")
        
        # Create payload index for 'metadata.source' — required by Qdrant Cloud for filtered search
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="metadata.source",
            field_schema=PayloadSchemaType.KEYWORD
        )
        print("✅ Payload index on 'metadata.source' ensured.")
            
    except Exception as e:
        # Index already exists errors are safe to ignore
        if "already exists" not in str(e).lower():
            print(f"❌ Error initializing Qdrant: {str(e)}")

# Run initialization on import
init_qdrant()