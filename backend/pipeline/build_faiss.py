import os

from utils.logger import pipeline_logger
from pipeline.embeddings import generate_embeddings_and_index_from_json


def build_faiss(data_dir: str) -> bool:
    """
    Build FAISS index + metadata.json from data/gita.json
    """
    gita_json_path = os.path.join(data_dir, "gita.json")
    faiss_index_path = os.path.join(data_dir, "faiss.index")
    metadata_output_path = os.path.join(data_dir, "metadata.json")
    pipeline_logger.info("Building FAISS index from gita.json...")
    return generate_embeddings_and_index_from_json(gita_json_path, faiss_index_path, metadata_output_path)

