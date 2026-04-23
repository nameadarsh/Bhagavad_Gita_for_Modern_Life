from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Any

import faiss
from sentence_transformers import SentenceTransformer

from app.services.prompt_loader import load_prompt


DEBUG = False


@dataclass(frozen=True)
class LoadedData:
    verses_by_id: Dict[str, Dict[str, Any]]
    verses: List[Dict[str, Any]]
    chapters: Dict[int, Dict[str, Any]]
    metadata: List[Dict[str, Any]]
    faiss_index: faiss.Index
    prompts: Dict[str, str]


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_prompts() -> Dict[str, str]:
    # Required prompt files (loaded once, cached by prompt_loader)
    return {
        "chat_prompt.txt": load_prompt("chat_prompt.txt"),
        "query_refine.txt": load_prompt("query_refine.txt"),
        "summarization.txt": load_prompt("summarization.txt"),
    }


def build_chapters(verses: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
    chapters: Dict[int, Dict[str, Any]] = {}
    for v in verses:
        ch = int(v["chapter"])
        chapters.setdefault(ch, {"chapter": ch, "verses": [], "speakers": {}, "themes": {}})
        chapters[ch]["verses"].append(v)
        sp = (v.get("speaker") or "Unknown").strip()
        chapters[ch]["speakers"][sp] = chapters[ch]["speakers"].get(sp, 0) + 1
        for t in (v.get("themes") or []):
            t = (t or "").strip().lower()
            if not t:
                continue
            chapters[ch]["themes"][t] = chapters[ch]["themes"].get(t, 0) + 1

    # finalize
    for ch, obj in chapters.items():
        obj["verses"].sort(key=lambda x: int(x["verse"]))
        obj["verse_count"] = len(obj["verses"])
        obj["speakers_top"] = sorted(obj["speakers"].items(), key=lambda kv: kv[1], reverse=True)
        obj["themes_top"] = sorted(obj["themes"].items(), key=lambda kv: kv[1], reverse=True)
    return chapters


def load_all(base_dir: Path) -> LoadedData:
    data_dir = base_dir / "data"

    gita_path = data_dir / "gita.json"
    metadata_path = data_dir / "metadata.json"
    faiss_path = data_dir / "faiss.index"

    verses = _load_json(gita_path)
    if not isinstance(verses, list):
        raise ValueError("data/gita.json must be a list")
    verses_by_id = {v["id"]: v for v in verses}

    metadata = _load_json(metadata_path)
    if not isinstance(metadata, list):
        raise ValueError("data/metadata.json must be a list")

    if not faiss_path.exists():
        raise RuntimeError("FAISS index not found at data/faiss.index. Ensure data is prepared.")

    faiss_index = faiss.read_index(str(faiss_path))
    if DEBUG:
        print(f"[DATA LOAD] Loaded {len(verses)} total verses")
        print(f"[DATA LOAD] Loaded {len(metadata)} metadata entries")
        print(f"[DATA LOAD] Index built with {faiss_index.ntotal} vectors")

    prompts = load_prompts()

    chapters = build_chapters(verses)

    return LoadedData(
        verses_by_id=verses_by_id,
        verses=verses,
        chapters=chapters,
        metadata=metadata,
        faiss_index=faiss_index,
        prompts=prompts,
    )

