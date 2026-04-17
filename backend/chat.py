"""
chat.py — /api/chat endpoint.

POST /api/chat
  Body:    { "message": str, "history": [{"role": "user"|"assistant", "content": str}] }
  Returns: { "reply": str }

Conversation history is managed client-side and sent with each request.
History is capped at the last MAX_HISTORY_TURNS turns to stay within token limits.
"""

import os
from groq import Groq
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .knowledge import SYSTEM_PROMPT

router = APIRouter()

# Initialise the Groq client (reads GROQ_API_KEY from environment)
_client = Groq()

MODEL = "llama-3.3-70b-versatile"
MAX_HISTORY_TURNS = 10   # keep last N user+assistant pairs (= 2*N messages)
MAX_TOKENS = 512


class ChatMessage(BaseModel):
    role: str = Field(..., pattern=r"^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    # Cap history to the last MAX_HISTORY_TURNS exchanges
    trimmed_history = req.history[-(MAX_HISTORY_TURNS * 2):]

    messages = (
        [{"role": "system", "content": SYSTEM_PROMPT}]
        + [{"role": m.role, "content": m.content} for m in trimmed_history]
        + [{"role": "user", "content": req.message}]
    )

    try:
        completion = _client.chat.completions.create(
            model=MODEL,
            messages=messages,
            max_tokens=MAX_TOKENS,
            temperature=0.7,
        )
        reply = completion.choices[0].message.content or ""
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc

    return ChatResponse(reply=reply)
