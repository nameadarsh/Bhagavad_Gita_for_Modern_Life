import logging
import os
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parents[1]

def setup_logger(name, log_file, level=logging.INFO):
    """Function setup as many loggers as you want"""
    
    formatter = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
    
    # Ensure logs directory exists
    log_dir = Path(log_file).parent
    os.makedirs(log_dir, exist_ok=True)
    
    handler = logging.FileHandler(log_file, mode='a')
    handler.setFormatter(formatter)

    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Prevent adding handlers multiple times
    if not logger.handlers:
        logger.addHandler(handler)

    return logger

# Configure specific loggers
pipeline_logger = setup_logger('pipeline', str(_BACKEND_DIR / 'logs' / 'pipeline.log'))
error_logger = setup_logger('error', str(_BACKEND_DIR / 'logs' / 'errors.log'), level=logging.ERROR)
