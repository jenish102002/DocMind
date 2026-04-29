# Resume Bullet Points for DocMind

## Option 1: Focus on Full-Stack & Architecture (Software Engineer)
**DocMind - AI Document Intelligence Platform**
*   **Architected and deployed** a full-stack Retrieval-Augmented Generation (RAG) platform using **FastAPI** and **React**, enabling users to perform semantic search and Q&A across multiple PDF documents simultaneously.
*   **Engineered a scalable ingestion pipeline** using **PyMuPDF** and **LangChain** to parse, chunk, and embed documents into a **Qdrant Vector Database**, utilizing **NVIDIA NIM** (nv-embed-v1) for high-dimensional (4096) vector representations.
*   **Implemented real-time features**, including Server-Sent Events (SSE) for streaming LLM (`meta/llama-3.1-70b-instruct`) responses and an asynchronous background processing system with real-time UI progress tracking via **Redis**.
*   **Designed a hybrid memory system** leveraging **Upstash Redis** to maintain conversational context and manage user sessions, optimizing LLM token usage and ensuring continuous context awareness.
*   **Deployed a zero-cost, cloud-native infrastructure** by containerizing services with **Docker** and orchestrating deployments across **Render** (Backend), **Vercel** (Frontend), **Qdrant Cloud**, and **Upstash**.

## Option 2: Focus on AI & Data Engineering (AI/ML Engineer)
**DocMind - Multi-Document RAG System**
*   **Developed an advanced multi-document RAG system** leveraging **NVIDIA NIM** (`llama-3.1-70b-instruct`) for accurate, context-aware question answering and information extraction from complex PDF corpora.
*   **Optimized semantic search** by integrating **Qdrant Vector DB** and implementing Maximal Marginal Relevance (MMR) retrieval, ensuring the LLM receives diverse and highly relevant context chunks, reducing hallucinations.
*   **Built a robust document processing pipeline** using **LangChain** and **PyMuPDF**, applying recursive character splitting strategies to maintain semantic coherence across 700-token chunks with precise metadata attribution.
*   **Implemented selective querying capabilities** using payload indexing and OR-filtered vector search, allowing users to dynamically isolate searches to specific documents or query the entire knowledge base.
*   **Created a persistent conversational state** by designing a sliding-window memory architecture backed by **Redis**, allowing the LLM to recall previous interactions and provide follow-up answers seamlessly.

## Option 3: Concise (For limited space)
**DocMind - RAG-Powered Document Q&A App**
*   Built a full-stack RAG application (React, FastAPI) allowing users to query multiple PDFs using **NVIDIA NIM** (`Llama 3.1 70B`) and streaming responses.
*   Engineered the document ingestion pipeline using **LangChain** to embed and store chunks in **Qdrant Vector DB**, enabling precise semantic search with MMR.
*   Integrated **Redis** for managing chat session memory and tracking background file processing progress in real-time.
*   Deployed the containerized architecture to production using **Render**, **Vercel**, **Upstash**, and **Qdrant Cloud**.

## Key Technical Skills to Highlight:
*   **Languages:** Python, JavaScript/React
*   **AI/ML:** LangChain, RAG, NVIDIA NIM (LLMs & Embeddings), Vector Databases (Qdrant), MMR Search
*   **Backend:** FastAPI, Asynchronous Programming, Server-Sent Events (SSE)
*   **Infrastructure/Tools:** Docker, Redis (Upstash), Render, Vercel, PyMuPDF
