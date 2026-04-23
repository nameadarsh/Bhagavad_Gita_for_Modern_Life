from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException

from app.models.schemas import ChapterInfo, Verse


router = APIRouter()


@router.get("/chapters", response_model=list[ChapterInfo])
def get_chapters(request: Request):
    chapters = request.app.state.chapters
    out = []
    for ch in sorted(chapters.keys()):
        obj = chapters[ch]
        speakers = [k for k, _ in obj.get("speakers_top", [])][:10]
        themes_top = [k for k, _ in obj.get("themes_top", [])][:10]
        out.append(ChapterInfo(chapter=ch, verse_count=obj.get("verse_count", 0), speakers=speakers, themes_top=themes_top))
    return out


@router.get("/chapter/{chapter_number}")
def get_chapter(chapter_number: int, request: Request):
    chapters = request.app.state.chapters
    if chapter_number not in chapters:
        raise HTTPException(status_code=404, detail="Chapter not found")
    obj = chapters[chapter_number]
    return {
        "info": {
            "chapter": chapter_number,
            "verse_count": obj.get("verse_count", 0),
            "speakers": [k for k, _ in obj.get("speakers_top", [])][:10],
            "themes_top": [k for k, _ in obj.get("themes_top", [])][:10],
        },
        "verses": [Verse(**v).model_dump() for v in obj.get("verses", [])],
    }

