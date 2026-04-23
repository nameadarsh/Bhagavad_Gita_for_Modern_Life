import json
import os
from utils.logger import pipeline_logger, error_logger

def build_json(records, output_path):
    """
    Saves the final records to a JSON file.

    Expected record structure:
    {
      "id": "1_1",
      "chapter": 1,
      "verse": 1,
      "sanskrit": "...",
      "english": "...",
      "brief_explanation": "...",
      "themes": [...]
    }
    """
    pipeline_logger.info(f"Building JSON with {len(records)} records...")
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
        pipeline_logger.info(f"Successfully saved records to {output_path}")
    except Exception as e:
        error_logger.error(f"Failed to save JSON to {output_path}: {e}")
