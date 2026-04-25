# 🧠 DocMind — AI Document Intelligence

> Upload PDFs, ask questions, extract insights — powered by **NVIDIA NIM LLMs** and **RAG** with multi-document search.

![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688?logo=fastapi)
![LangChain](https://img.shields.io/badge/LangChain-1.2-green)

## ✨ Features

- **Multi-PDF Upload & Embedding** — Upload multiple PDFs; each is chunked and embedded into Qdrant Vector DB using NVIDIA `nv-embed-v1` (4096-dim).
- **Intelligent RAG Queries** — Ask questions across all documents or target specific files with MMR-based diverse retrieval.
- **Streaming LLM Responses** — Real-time token streaming from `meta/llama-3.1-70b-instruct` via NVIDIA NIM.
- **Session Memory** — Hybrid memory (recent history + long-term summary) stored in Redis so the LLM never forgets context.
- **Multi-File Targeting** — Select specific PDFs to focus your queries using OR-filtered vector search.
- **Session Management** — Create, switch, and delete chat sessions with auto-titled conversations.

## 🏗️ Architecture

```
┌────────────────┐     HTTP/SSE      ┌──────────────────┐
│  React + Vite  │ ───────────────▶  │   FastAPI (API)  │
│  (Vercel)      │                   │   (Render)       │
└────────────────┘                   └────────┬─────────┘
                                              │
                          ┌───────────────────┼───────────────────┐
                          │                   │                   │
                    ┌─────▼─────┐      ┌──────▼──────┐    ┌──────▼──────┐
                    │  Upstash  │      │ Qdrant Cloud│    │ NVIDIA NIM  │
                    │  Redis    │      │ Vector DB   │    │ LLM + Embed │
                    └───────────┘      └─────────────┘    └─────────────┘
                    Sessions,           PDF Embeddings     Llama 3.1 70B
                    History,            (4096-dim)         nv-embed-v1
                    File Registry
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, TailwindCSS v4, Framer Motion, Lucide Icons |
| **Backend** | FastAPI, LangChain, LangChain-NVIDIA, PyMuPDF |
| **LLM** | NVIDIA NIM — `meta/llama-3.1-70b-instruct` |
| **Embeddings** | NVIDIA NIM — `nvidia/nv-embed-v1` (4096 dimensions) |
| **Vector DB** | Qdrant Cloud (Cosine similarity, MMR retrieval) |
| **Cache/State** | Upstash Redis (sessions, chat history, file registry) |

## 🚀 Quick Start (Local)

### Prerequisites
- Python 3.11+
- Node.js 18+
- [NVIDIA NIM API Key](https://build.nvidia.com)

### 1. Clone & Setup Backend
```bash
git clone https://github.com/YOUR_USERNAME/DocMind.git
cd DocMind

# Create .env with your keys
cp .env.example .env  # Then edit with your keys

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. Open http://localhost:5173

## 🌐 Environment Variables

```env
NVIDIA_API_KEY=nvapi-xxx
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
QDRANT_URL=https://xxx.cloud.qdrant.io:6333
QDRANT_API_KEY=xxx
FRONTEND_URL=http://localhost:5173
```

## 📁 Project Structure

```
DocMind/
├── backend/
│   ├── main.py          # FastAPI app — sessions, files, query endpoints
│   ├── ingestion.py     # PDF extraction → chunking → Qdrant embedding
│   ├── query.py         # RAG pipeline — memory + MMR search + LLM stream
│   └── database.py      # Qdrant client init & collection setup
├── frontend/
│   ├── src/App.jsx      # Full chat UI — sidebar, sessions, file management
│   ├── src/index.css    # TailwindCSS v4 theme + custom scrollbar
│   └── index.html       # Entry point with SEO meta tags
├── Dockerfile           # Python 3.11-slim container for backend
├── docker-compose.yml   # Orchestrates web + Redis + Qdrant
└── requirements.txt     # Pinned Python dependencies
```

## 📄 License

MIT License — feel free to use and modify.
