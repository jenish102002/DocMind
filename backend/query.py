import os
import json
import redis
import tiktoken
from qdrant_client.http import models
from langchain_nvidia_ai_endpoints import ChatNVIDIA, NVIDIAEmbeddings
from langchain_qdrant import QdrantVectorStore
from database import client, COLLECTION_NAME
from dotenv import load_dotenv

# Load environment variables (NVIDIA API Key, etc.)
load_dotenv()

# --- PRODUCTION-READY REDIS ---
# Supports Upstash (rediss://), Docker (redis://redis:6379), and local (redis://localhost:6379)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_kwargs = {"decode_responses": True}
if REDIS_URL.startswith("rediss://"):
    redis_kwargs["ssl_cert_reqs"] = "none"
redis_client = redis.from_url(REDIS_URL, **redis_kwargs)

embeddings = NVIDIAEmbeddings(model="nvidia/nv-embed-v1")

# Retain the 70B model for deep analytical extraction and complex reasoning
llm = ChatNVIDIA(
    model="meta/llama-3.1-70b-instruct", 
    temperature=0.3,
    max_tokens=2048  # Increases the output limit so it doesn't get cut off
)
tokenizer = tiktoken.get_encoding("cl100k_base")

# Instantiate the VectorStore once
vector_store = QdrantVectorStore(
    client=client,
    collection_name=COLLECTION_NAME,
    embedding=embeddings,
)

def get_hybrid_memory(session_id: str):
    """Retrieves long-term summary and recent messages from Redis."""
    summary_key = f"docmind:summary:{session_id}"
    history_key = f"docmind:recent:{session_id}"
    
    current_summary = redis_client.get(summary_key) or "Start of conversation."
    history_raw = redis_client.get(history_key) or "[]"
    recent_history = json.loads(history_raw)
    
    return current_summary, recent_history

def process_chat_query_stream(user_query, session_id, selected_files=None):
    # 1. Fetch Session Memory
    summary, recent_history = get_hybrid_memory(session_id)
    history_str = "\n".join([f"{m['role']}: {m['content']}" for m in recent_history[-5:]])

    # 2. Build the Multi-File Filter (OR Logic)
    search_filter = None
    # Check if selected_files is a valid list and actually contains items
    if selected_files and isinstance(selected_files, list) and len(selected_files) > 0:
        print(f"--- [FILTER ACTIVE] Focusing on {len(selected_files)} specific files ---")
        
        # Create a FieldCondition for each selected file
        conditions = [
            models.FieldCondition(key="metadata.source", match=models.MatchValue(value=f))
            for f in selected_files
        ]
        
        # Using 'should' tells Qdrant to match if chunk belongs to File A OR File B
        search_filter = models.Filter(should=conditions)

    # 3. Vector Retrieval using MMR (Maximal Marginal Relevance)
    try:
        if search_filter:
            # Target search across the selected subset
            docs = vector_store.max_marginal_relevance_search(
                query=user_query,
                k=8,  # Increased to 8 to pull enough chunks for multiple files
                fetch_k=30,
                filter=search_filter
            )
        else:
            print("--- [GLOBAL SEARCH] Using MMR for diverse multi-document retrieval ---")
            # For All Documents, fetch 50 and return the 12 most diverse chunks
            # lambda_mult=0.5 balances relevance with document diversity
            docs = vector_store.max_marginal_relevance_search(
                query=user_query,
                k=12,
                fetch_k=50,
                lambda_mult=0.5
            )

        context_text = "\n\n---\n\n".join([doc.page_content for doc in docs])
        print(f"--- [RETRIEVAL SUCCESS] Sent {len(docs)} diverse chunks to LLM ---")
        
    except Exception as e:
        print(f"Search Error: {e}")
        context_text = "Knowledge base search failed."

    # 4. Intelligent Prompt Design
    final_prompt = f"""
    You are DocMind, an advanced document intelligence AI. Answer the user's question directly, professionally, and comprehensively using ONLY the provided Context and History.

    CORE INSTRUCTIONS:
    1. Extract Details: If asked about a specific person, extract and summarize their actual details from the Context (e.g., skills, experience, education).
    2. Document Collisions & Multiple Candidates: If the context contains information from multiple different documents or resumes, you MUST list all of them clearly. Do not mix up their profiles. Attribute the correct experience to the correct person.
    3. Missing Info: If the answer cannot be found in the Context, clearly state that the uploaded documents do not contain that information.

    [DOCUMENT CONTEXT]: 
    {context_text}
    
    [LONG-TERM SUMMARY]: 
    {summary}
    
    [RECENT HISTORY]: 
    {history_str}
    
    User Question: {user_query}
    DocMind Answer:"""

    # 5. Stream Tokens & Accumulate Response
    full_answer = ""
    for chunk in llm.stream(final_prompt):
        full_answer += chunk.content
        yield chunk.content

    # 6. Save to Persistent Redis History
    recent_history.append({"role": "user", "content": user_query})
    recent_history.append({"role": "assistant", "content": full_answer})
    redis_client.set(f"docmind:recent:{session_id}", json.dumps(recent_history))

    # 7. Auto-update session title on first meaningful interaction
    if len(recent_history) <= 2:  # If this is the first user/assistant exchange
        session_data_raw = redis_client.hget("docmind:sessions", session_id)
        if session_data_raw:
            session_data = json.loads(session_data_raw)
            # Create a clean title from the user's first query
            session_data["title"] = user_query[:25] + ("..." if len(user_query) > 25 else "")
            redis_client.hset("docmind:sessions", session_id, json.dumps(session_data))