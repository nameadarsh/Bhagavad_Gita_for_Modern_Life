import os
import sys
import argparse
from utils.logger import pipeline_logger, error_logger
from pipeline.load_dataset import load_verses
from pipeline.clean_dataset import clean_verses
from pipeline.llm_processor import generate_brief_explanation, generate_themes, check_ollama_status
from pipeline.json_builder import build_json
from pipeline.build_faiss import build_faiss
from utils.validators import validate_dataset, validate_faiss_consistency
from tqdm import tqdm

def main():
    pipeline_logger.info("Starting Bhagavad Gita RAG Pipeline...")
    
    parser = argparse.ArgumentParser(description="Bhagavad Gita offline RAG indexing pipeline")
    parser.add_argument("--dataset-dir", type=str, default=None, help="Dataset directory containing verse JSONs (default: backend/data/slok)")
    parser.add_argument("--skip-llm", action="store_true", help="Skip LLM enrichment (brief_explanation + themes)")
    parser.add_argument("--allow-non700", action="store_true", help="Allow verse count not near 700 (testing only)")
    parser.add_argument("--limit", type=int, default=None, help="Process only first N verses (testing only)")
    args = parser.parse_args()

    # Configuration
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    dataset_dir = args.dataset_dir or os.path.join(data_dir, "slok")
    json_output_path = os.path.join(data_dir, "gita.json")
    metadata_output_path = os.path.join(data_dir, "metadata.json")
    
    # Step 1: Load dataset (JSON only)
    raw_verses = load_verses(dataset_dir)

    # Step 2: Clean/normalize dataset
    verses = clean_verses(raw_verses)
    if args.limit is not None and args.limit > 0:
        verses = verses[: args.limit]

    # Step 3: (Optional) LLM enrichment
    if not args.skip_llm:
        if not check_ollama_status():
            error_logger.error("Pipeline halted due to Ollama unavailability (disable with --skip-llm).")
            sys.exit(1)

        pipeline_logger.info(f"Enriching {len(verses)} verses with LLM...")
        for v in tqdm(verses, desc="LLM Enrichment"):
            explanation = generate_brief_explanation(v.get("_commentary", ""))
            v["brief_explanation"] = explanation
            v["themes"] = generate_themes(explanation)
            # Remove internal-only field before saving output
            if "_commentary" in v:
                del v["_commentary"]
    else:
        # Even when skipping LLM, ensure internal-only fields don't leak to output schema
        for v in verses:
            if "_commentary" in v:
                del v["_commentary"]

    # Step 4: Validate dataset (hard stop if dirty)
    if not validate_dataset(verses, allow_non700=args.allow_non700 or (args.limit is not None)):
        error_logger.error("Pipeline halted: dataset validation failed.")
        sys.exit(1)

    # Step 5: Build final JSON
    build_json(verses, json_output_path)

    # Step 6: Build FAISS index + metadata
    success = build_faiss(data_dir)
    if not success:
        error_logger.error("Pipeline failed during embedding/index stage.")
        sys.exit(1)

    # Step 7: Consistency check
    validate_faiss_consistency(json_output_path, metadata_output_path, len(verses))
    pipeline_logger.info("Pipeline completed successfully.")

if __name__ == "__main__":
    main()
