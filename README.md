# 🧠 DocMind — Multi-PDF Q&A

> An AI-powered document intelligence platform that lets you upload multiple PDFs and have deep, context-aware conversations across all of them simultaneously.

![Tech Stack](https://img.shields.io/badge/Stack-FastAPI%20%7C%20React%20%7C%20Qdrant%20%7C%20NVIDIA%20NIM-blue)
![Python](https://img.shields.io/badge/Python-3.11+-green)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

---

## ✨ Features

- **Multi-PDF Upload** — Upload and index multiple PDF documents at once
- **Selective Document Querying** — Choose specific files to query, or ask across all uploaded documents
- **Streaming AI Responses** — Answers stream in real-time using LLaMA 3.1 70B via NVIDIA NIM
- **Persistent Session Memory** — Conversations are stored per-session with hybrid short-term and long-term memory (Redis)
- **Real-Time Ingestion Progress** — Live progress bar tracking as PDFs are chunked and embedded in the background
- **Semantic Vector Search** — Uses NVIDIA `nv-embed-v1` (4096-dim) embeddings stored in Qdrant
- **MMR Retrieval** — Maximal Marginal Relevance ensures diverse, high-quality chunks are sent to the LLM
- **Multi-Document Attribution** — Clearly attributes answers to the correct source document(s)
- **Session Management** — Create, rename (auto-titled from first query), and delete chat sessions
- **File Management** — Upload and delete individual PDFs from the knowledge base
- **Docker Support** — Full Docker Compose setup with Redis and Qdrant included

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)               │
│           Tailwind CSS · Framer Motion · react-markdown      │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST + Streaming
┌──────────────────────────────▼──────────────────────────────┐
│                      Backend (FastAPI)                        │
│  ┌────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ Ingestion  │  │  Query / Stream │  │  Session Routes  │  │
│  │ (PyMuPDF + │  │  (LangChain +   │  │  (Redis CRUD)    │  │
│  │  LangChain)│  │  NVIDIA NIM)    │  │                  │  │
│  └─────┬──────┘  └────────┬────────┘  └──────────────────┘  │
└────────┼─────────────────┼───────────────────────────────────┘
         │                 │
    ┌────▼────┐       ┌────▼────────┐
    │ Qdrant  │       │    Redis    │
    │ Vector  │       │  (History + │
    │   DB    │       │  Sessions)  │
    └─────────┘       └─────────────┘
                            │
                   ┌────────▼────────┐
                   │  NVIDIA NIM API │
                   │  nv-embed-v1    │
                   │  llama-3.1-70b  │
                   └─────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS v4, Framer Motion, Lucide React |
| **Backend** | FastAPI, Python 3.11, Uvicorn |
| **LLM** | `meta/llama-3.1-70b-instruct` via NVIDIA NIM |
| **Embeddings** | `nvidia/nv-embed-v1` (4096 dimensions) |
| **Vector DB** | Qdrant (local Docker or Qdrant Cloud) |
| **Session Store** | Redis (local, Docker, or Upstash) |
| **PDF Parsing** | PyMuPDF |
| **Text Splitting** | LangChain `RecursiveCharacterTextSplitter` |
| **Containerization** | Docker + Docker Compose |

---

## 📁 Project Structure

```
multi-pdf-qna/
├── backend/
│   ├── main.py          # FastAPI app, all API routes
│   ├── ingestion.py     # PDF parsing, chunking, embedding pipeline
│   ├── query.py         # RAG query, MMR retrieval, streaming, memory
│   ├── database.py      # Qdrant client + collection initialization
│   └── requirements.txt # Backend dependencies
├── frontend/
│   ├── src/             # React components and pages
│   ├── package.json     # Frontend dependencies
│   └── vite.config.js   # Vite configuration
├── Dockerfile           # Backend Docker image
├── docker-compose.yml   # Full stack: app + Redis + Qdrant
├── requirements.txt     # Top-level Python dependencies
├── .env.example         # Environment variable template
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose (optional but recommended)
- [NVIDIA NIM API Key](https://build.nvidia.com) — free tier available

---

### Option 1: Docker Compose (Recommended)

This starts the backend, Redis, and Qdrant in one command.

**1. Clone the repository**
```bash
git clone https://github.com/jenish102002/DocMind.git
cd DocMind/multi-pdf-qna
```

**2. Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` and fill in your NVIDIA API key:
```env
NVIDIA_API_KEY=nvapi-YOUR_KEY_HERE
```

*(Redis and Qdrant URLs are pre-configured for Docker — no changes needed for local use.)*

**3. Start all services**
```bash
docker-compose up --build
```

**4. Start the frontend separately**
```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

### Option 2: Manual Local Setup

**1. Start Qdrant**
```bash
docker run -p 6333:6333 qdrant/qdrant
```

**2. Start Redis**
```bash
docker run -p 6379:6379 redis:alpine
```

**3. Set up the backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r ../requirements.txt
```

Create a `.env` file in `multi-pdf-qna/` (or `backend/`):
```env
NVIDIA_API_KEY=nvapi-YOUR_KEY_HERE
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
FRONTEND_URL=http://localhost:5173
```

Run the backend:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**4. Set up the frontend**
```bash
cd frontend
npm install
npm run dev
```

---

## ⚙️ Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NVIDIA_API_KEY` | API key from [build.nvidia.com](https://build.nvidia.com) | *(required)* |
| `REDIS_URL` | Redis connection string. Use `rediss://` prefix for Upstash TLS | `redis://localhost:6379` |
| `QDRANT_URL` | Qdrant instance URL (local or cloud) | `http://localhost:6333` |
| `QDRANT_API_KEY` | API key for Qdrant Cloud (leave blank for local) | `None` |
| `FRONTEND_URL` | Frontend origin for CORS — update after deploying | `http://localhost:5173` |

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/sessions` | List all chat sessions |
| `POST` | `/api/sessions` | Create a new session |
| `DELETE` | `/api/sessions/{id}` | Delete a session and its history |
| `GET` | `/api/history/{session_id}` | Get chat history for a session |
| `GET` | `/api/files` | List all uploaded files |
| `POST` | `/api/upload` | Upload a PDF (triggers background ingestion) |
| `GET` | `/api/upload/status/{filename}` | Poll real-time ingestion progress |
| `DELETE` | `/api/files/{filename}` | Delete a file from Redis and Qdrant |
| `POST` | `/api/query` | Ask a question (streams response) |

**Query Request Body:**
```json
{
  "query": "What is the candidate's experience with Python?",
  "session_id": "sid_1234567890",
  "selected_files": ["resume_alice.pdf", "resume_bob.pdf"]
}
```
Pass an empty array `[]` for `selected_files` to query across all uploaded documents.

---

## 🧩 How It Works

1. **Upload** — PDFs are saved to `temp_uploads/`, registered in Redis, and processed in a background task.
2. **Ingestion** — PyMuPDF extracts text → LangChain splits into 700-token chunks with 100-token overlap → NVIDIA `nv-embed-v1` embeds each chunk → stored in Qdrant with `metadata.source` (filename) and `chunk_index`.
3. **Query** — User sends a query with optional file filter → Qdrant performs MMR-based vector search (filtered or global) → top chunks are assembled into context → LLaMA 3.1 70B streams the answer.
4. **Memory** — Each session maintains a sliding window of the last 5 messages in Redis. Session titles are auto-generated from the first user query.

---

## ☁️ Cloud Deployment

DocMind is designed to work with managed cloud services:

- **Redis** → [Upstash](https://upstash.com) (serverless Redis, use `rediss://` URL)
- **Qdrant** → [Qdrant Cloud](https://cloud.qdrant.io) (set `QDRANT_URL` and `QDRANT_API_KEY`)
- **Backend** → Any platform supporting Docker (Railway, Render, Fly.io)
- **Frontend** → Vercel or Netlify (update `FRONTEND_URL` in `.env` after deploy)

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push and open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

*Built with ❤️ using NVIDIA NIM, Qdrant, FastAPI, and React.*