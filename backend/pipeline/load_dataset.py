import json
import os
from typing import Any, Dict, List

from utils.logger import pipeline_logger, error_logger


def _load_json_file(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_verses(data_dir: str) -> List[Dict[str, Any]]:
    """
    Load structured verse data from a dataset directory.

    Supported layouts:
    - Single combined JSON file: <data_dir>/verses.json (list[object] or {"verses": list[object]})
    - Multiple JSON files: any *.json files under <data_dir> (each file is a verse object)
    """
    if not os.path.isdir(data_dir):
        raise FileNotFoundError(f"Dataset directory not found: {data_dir}")

    combined_path = os.path.join(data_dir, "verses.json")
    if os.path.exists(combined_path):
        payload = _load_json_file(combined_path)
        if isinstance(payload, list):
            verses = payload
        elif isinstance(payload, dict) and isinstance(payload.get("verses"), list):
            verses = payload["verses"]
        else:
            raise ValueError(f"Unsupported verses.json format in {combined_path}")

        pipeline_logger.info(f"Loaded {len(verses)} verses from {combined_path}")
        return verses

    # Multi-file dataset
    files = [
        os.path.join(data_dir, name)
        for name in os.listdir(data_dir)
        if name.lower().endswith(".json")
    ]
    files.sort()
    if not files:
        raise FileNotFoundError(f"No JSON dataset files found in: {data_dir}")

    verses: List[Dict[str, Any]] = []
    for path in files:
        try:
            obj = _load_json_file(path)
            if not isinstance(obj, dict):
                error_logger.error(f"Skipping non-object JSON in {path}")
                continue
            obj["_source_file"] = os.path.basename(path)
            verses.append(obj)
        except Exception as e:
            error_logger.error(f"Failed to load {path}: {e}")

    pipeline_logger.info(f"Loaded {len(verses)} verse objects from {data_dir} (multi-file)")
    return verses

