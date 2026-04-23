from __future__ import annotations

import random

from fastapi import APIRouter, Request

from app.models.schemas import Verse


router = APIRouter()


@router.get("/daily", response_model=Verse)
def daily(request: Request):
    verses = request.app.state.verses
    v = random.choice(verses)
    return Verse(**v)

