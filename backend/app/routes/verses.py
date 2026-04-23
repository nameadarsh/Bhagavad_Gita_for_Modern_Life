from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException

from app.models.schemas import Verse


router = APIRouter()


@router.get("/verse/{id}", response_model=Verse)
def get_verse(id: str, request: Request):
    verse = request.app.state.verses_by_id.get(id)
    if not verse:
        raise HTTPException(status_code=404, detail="Verse not found")
    return Verse(**verse)


@router.get("/verses", response_model=list[Verse])
def get_all_verses(request: Request):
    return [Verse(**v) for v in request.app.state.verses]

