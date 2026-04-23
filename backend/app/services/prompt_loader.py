from __future__ import annotations

from pathlib import Path
from typing import Dict
import logging


_PROMPT_CACHE: Dict[str, str] = {}
DEBUG = True


DEBUG = False


def load_prompt(filename: str) -> str:
    """
    Load a prompt from app/prompts/<file_name>.
    Cached in memory after first read.
    """
    if filename in _PROMPT_CACHE:
        return _PROMPT_CACHE[filename]

    prompts_dir = Path(__file__).resolve().parents[1] / "prompts"
    path = prompts_dir / filename
    content = path.read_text(encoding="utf-8") if path.exists() else ""
    if DEBUG:
        print(f"[PROMPT LOAD] {filename}: {content[:100]!r}")
    if not content.strip():
        logging.getLogger("analytics").warning(f"Prompt file empty: skipping LLM ({filename})")
    _PROMPT_CACHE[filename] = content
    return content

