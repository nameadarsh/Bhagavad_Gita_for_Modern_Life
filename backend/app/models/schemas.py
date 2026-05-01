from __future__ import annotations

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class Verse(BaseModel):
    id: str
    chapter: int
    verse: int
    speaker: str
    sanskrit: str
    english: str
    brief_explanation: str
    themes: List[str]


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1)
    session_id: Optional[str] = None
    verse_id: Optional[str] = None
    voice_output: Optional[bool] = False
    language: str = "en"


class ChatResponse(BaseModel):
    session_id: str
    answer: str
    verse: Verse
    meta: Dict[str, Any] = Field(default_factory=dict)


class ChapterInfo(BaseModel):
    chapter: int
    verse_count: int
    speakers: List[str]
    themes_top: List[str]


class TTSRequest(BaseModel):
    text: str
    language: str = "en"


class FeedbackRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    name: Optional[str] = None
    feedback: Optional[str] = None

