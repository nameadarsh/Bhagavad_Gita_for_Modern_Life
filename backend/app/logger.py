import logging
import os
from pathlib import Path


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def setup_app_loggers(base_dir: Path) -> None:
    """
    Configure two file loggers:
    - logs/conversations.log
    - logs/analytics.log
    """
    logs_dir = base_dir / "logs"
    _ensure_dir(str(logs_dir))

    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")

    conversations = logging.getLogger("conversations")
    conversations.setLevel(logging.INFO)
    if not conversations.handlers:
        h = logging.FileHandler(str(logs_dir / "conversations.log"))
        h.setFormatter(formatter)
        conversations.addHandler(h)

    analytics = logging.getLogger("analytics")
    analytics.setLevel(logging.INFO)
    if not analytics.handlers:
        h = logging.FileHandler(str(logs_dir / "analytics.log"))
        h.setFormatter(formatter)
        analytics.addHandler(h)

