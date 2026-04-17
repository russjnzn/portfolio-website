"""
main.py — FastAPI application entry point.

Routes:
  GET  /api/health  →  { "status": "ok" }
  POST /api/chat    →  { "reply": str }

Run locally:
  uvicorn backend.main:app --reload

Environment:
  GROQ_API_KEY  — required (set in .env at project root)
  ALLOWED_ORIGINS — optional comma-separated list of origins (default: localhost variants)
"""

import os
from dotenv import load_dotenv

# Load .env from the project root (one level above backend/)
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .chat import router as chat_router

# ── App ────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Portfolio AI Chat",
    description="AI assistant for Russel Janzen E. Mamaclay's portfolio website.",
    version="1.0.0",
)

# ── CORS ───────────────────────────────────────────────────────────────────
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_extra_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

ALLOWED_ORIGINS = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5500",
    "http://localhost:8080",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:8080",
    # Add your production domain here via ALLOWED_ORIGINS env var
    *_extra_origins,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# ── Routes ─────────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok"}


app.include_router(chat_router, prefix="/api")
