import os
import re
import hashlib
import logging
import base64
import httpx
from typing import Optional, Tuple
from supabase import create_client, Client

logger = logging.getLogger("analytics")

class TtsService:
    def __init__(self):
        # 3.1 INIT
        self.sarvam_api_key = os.getenv("SARVAM_API_KEY")
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        self.bucket_name = os.getenv("SUPABASE_BUCKET", "rag_gita_audio")
        
        if not all([self.supabase_url, self.supabase_key]):
            logger.error("[TTS] Supabase credentials missing")
            self.supabase = None
        else:
            try:
                self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
                logger.info("[TTS] Supabase client initialized")
            except Exception as e:
                logger.error(f"[TTS] Failed to initialize Supabase: {e}")
                self.supabase = None
        
        # Phase 7: Static Audio Mapping
        self.static_bucket = "rag_gita_static_audio"
        self.static_base_url = f"{self.supabase_url}/storage/v1/object/public/{self.static_bucket}"
        
    def get_static_audio_urls(self, chapter: int, verse: int, language: str) -> dict:
        """
        Returns mapping for static shlok, translation, and explanation audio.
        Uses deterministic paths as per requirement.
        """
        key = f"{chapter}_{verse}"
        
        return {
            "shlok": f"{self.static_base_url}/shlok/{key}.mp3",
            "translation": f"{self.static_base_url}/shlok_english_translation/{key}.mp3",
            "explanation": f"{self.static_base_url}/explanation/{key}.mp3"
        }

    def _clean_text(self, text: str) -> str:
        # 3.5 TEXT CLEANING
        text = re.sub(r'\s+', ' ', text).strip()
        text = text.replace('\n', ' ')
        return text

    def _get_hash(self, text: str, language: str) -> str:
        # 3.2 HASH FUNCTION
        return hashlib.md5(f"{text}{language.lower()}".encode()).hexdigest()

    def _get_public_url(self, path: str) -> str:
        # 3.3 PUBLIC URL FUNCTION
        return f"{self.supabase_url}/storage/v1/object/public/{self.bucket_name}/{path}"

    def _check_exists(self, path: str) -> bool:
        # 3.4 EXISTENCE CHECK (IMPORTANT)
        if not self.supabase:
            return False
        try:
            self.supabase.storage.from_(self.bucket_name).download(path)
            return True
        except Exception:
            return False

    async def get_audio_chunks(self, text: str, language: str = "en") -> Tuple[list[str], list[str]]:
        """
        Splits text into sentence-based chunks and generates audio for each.
        Returns (audio_urls, chunk_texts)
        """
        # 1. Clean and split text
        # Remove verse references and translations in brackets for TTS
        # The user wants ONLY the LLM response text spoken.
        # Our LLM response is formatted as:
        # {reflection}
        # {insight}
        # {sanskrit}
        # ({translation})
        # {meaning}
        
        # Split by double newlines to separate blocks
        blocks = [b.strip() for b in text.split('\n\n') if b.strip()]
        
        # Heuristic: Sanskrit blocks often contain specific characters or are followed by (Translation)
        # We want to skip blocks that look like Sanskrit or bracketed translations
        tts_blocks = []
        for block in blocks:
            # Skip if contains many Sanskrit characters or is bracketed
            # Fix: Ensure block is a string and handle potential empty blocks
            if not isinstance(block, str) or not block.strip():
                continue
                
            if re.search(r'[\u0900-\u097F]', block) and len(re.findall(r'[\u0900-\u097F]', block)) > 5:
                continue
            if block.startswith('(') and block.endswith(')'):
                continue
            tts_blocks.append(block)
        
        full_tts_text = " ".join(tts_blocks)
        
        # Log cleaned text for debugging
        logger.info(f"[TTS] Cleaned text for TTS: {full_tts_text[:100]}...")
        
        if not full_tts_text.strip():
            logger.warning("[TTS] No text remaining after cleaning")
            return [], []
        
        # 2. Sentence-based chunking
        # Split by . ! ? followed by space or newline
        sentences = re.split(r'(?<=[.!?])\s+', full_tts_text)
        
        chunks = []
        current_chunk = ""
        max_chars = 600 # Safe limit between 500-800
        
        for sentence in sentences:
            if len(current_chunk) + len(sentence) < max_chars:
                current_chunk += (" " + sentence if current_chunk else sentence)
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence
        if current_chunk:
            chunks.append(current_chunk.strip())

        audio_urls = []
        # Process chunks
        for chunk in chunks:
            url, _, _ = await self._get_single_chunk_audio(chunk, language)
            if url:
                audio_urls.append(url)
        
        return audio_urls, chunks

    async def _get_single_chunk_audio(self, clean_text: str, language: str) -> Tuple[Optional[str], bool, Optional[str]]:
        if not clean_text:
            return None, False, "EMPTY_TEXT"
            
        # Phase 11: Expanded Language Support
        # Map simple language codes to Sarvam target_language_code
        lang_map = {
            "en": "en-IN",
            "hi": "hi-IN",
            "bn": "bn-IN",
            "ta": "ta-IN",
            "te": "te-IN",
            "gu": "gu-IN",
            "kn": "kn-IN",
            "ml": "ml-IN",
            "mr": "mr-IN",
            "pa": "pa-IN",
            "or": "or-IN"
        }
        
        # Handle cases like 'en-IN' or 'en'
        base_lang = language.split("-")[0].lower()
        lang_code = lang_map.get(base_lang, "en-IN")
        
        text_hash = hashlib.md5(f"{clean_text}:{lang_code}".encode()).hexdigest()
        storage_path = f"tts/{base_lang}/{text_hash}.mp3"
        
        if self._check_exists(storage_path):
            return self._get_public_url(storage_path), True, None

        if not self.sarvam_api_key:
            return None, False, "CONFIG_ERROR"

        try:
            async with httpx.AsyncClient() as client:
                payload = {
                    "text": clean_text,
                    "target_language_code": lang_code,
                    "speaker": "shubh",
                    "model": "bulbul:v3",
                    "output_audio_codec": "mp3",
                    "pace": 0.88 # Calm, slower pace (0.85-0.9)
                }
                headers = {
                    "api-subscription-key": self.sarvam_api_key,
                    "Content-Type": "application/json"
                }
                
                response = await client.post(
                    "https://api.sarvam.ai/text-to-speech",
                    headers=headers,
                    json=payload,
                    timeout=30.0
                )
                
                if response.status_code != 200:
                    logger.error(f"[TTS] Sarvam API Error: {response.status_code} - {response.text}")
                    return None, False, "TTS_FAILED"
                
                data = response.json()
                audios = data.get("audios", [])
                if not audios:
                    logger.error(f"[TTS] No audio chunks in Sarvam response for text: {clean_text[:50]}...")
                    return None, False, "TTS_FAILED"
                
                audio_bytes = base64.b64decode("".join(audios))
                
                if self.supabase:
                    try:
                        self.supabase.storage.from_(self.bucket_name).upload(
                            path=storage_path,
                            file=audio_bytes,
                            file_options={"content-type": "audio/mpeg"}
                        )
                    except Exception as e:
                        logger.error(f"[TTS] Supabase upload failed: {e}")
                        # Continue even if upload fails, we have the URL if it's already there or just return URL
                
                return self._get_public_url(storage_path), False, None

        except Exception as e:
            logger.error(f"[TTS] Chunk error: {e}")
            return None, False, "PIPELINE_ERROR"

    async def get_audio(self, text: str, language: str = "en") -> Tuple[Optional[str], bool, Optional[str]]:
        """
        Returns (audio_url, cached, error_code)
        """
        # Clean and limit text
        # 1. Remove markdown
        clean_text = re.sub(r'[*#_`~]', '', text)
        # 2. Remove extra spaces/newlines
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        # 3. Limit to ~500 chars
        clean_text = clean_text[:500]

        if not clean_text:
            return None, False, "EMPTY_TEXT"
            
        # Target language code
        lang_code = "hi-IN" if language.lower() == "hi" else "en-IN"

        # Check cache
        text_hash = hashlib.md5(f"{clean_text}:{lang_code}".encode()).hexdigest()
        storage_path = f"tts/{language.lower()}/{text_hash}.mp3"
        
        # 1. CACHE CHECK
        if self._check_exists(storage_path):
            public_url = self._get_public_url(storage_path)
            logger.info(f"[TTS] Cache hit: {storage_path}")
            return public_url, True, None

        # 2. GENERATE VIA SARVAM
        if not self.sarvam_api_key:
            logger.error("[TTS] SARVAM_API_KEY missing")
            return None, False, "CONFIG_ERROR"

        try:
            async with httpx.AsyncClient() as client:
                # 3.6 SARVAM TTS CALL (CRITICAL)
                payload = {
                    "text": clean_text,
                    "target_language_code": lang_code,
                    "speaker": "shubh",
                    "model": "bulbul:v3",
                    "output_audio_codec": "mp3",
                    "pace": 1.1
                }
                headers = {
                    "api-subscription-key": self.sarvam_api_key,
                    "Content-Type": "application/json"
                }
                
                logger.info(f"[TTS] Generating: len={len(clean_text)} lang={lang_code}")
                
                response = await client.post(
                    "https://api.sarvam.ai/text-to-speech",
                    headers=headers,
                    json=payload,
                    timeout=30.0
                )
                
                # 3.7 RESPONSE HANDLING
                if response.status_code != 200:
                    logger.error(f"[TTS] API Error: {response.status_code} {response.text}")
                    return None, False, "TTS_FAILED"
                
                data = response.json()
                audios = data.get("audios", [])
                if not audios:
                    logger.error("[TTS] No audio chunks in response")
                    return None, False, "TTS_FAILED"
                
                # Join and decode
                combined_base64 = "".join(audios)
                audio_bytes = base64.b64decode(combined_base64)
                
                # 3.8 VALIDATE AUDIO
                if len(audio_bytes) < 5000:
                    logger.error(f"[TTS] Validation failed: size={len(audio_bytes)} < 5000")
                    return None, False, "INVALID_AUDIO"
                
                # 3.7 LOGGING (STEP 7)
                logger.info(f"[TTS] Generated: chunks={len(audios)} size={len(audio_bytes)}")

                # 3.9 UPLOAD TO SUPABASE
                if not self.supabase:
                    logger.error("[TTS] Cannot upload: Supabase not initialized")
                    return None, False, "CONFIG_ERROR"
                
                try:
                    self.supabase.storage.from_(self.bucket_name).upload(
                        path=storage_path,
                        file=audio_bytes,
                        file_options={"content-type": "audio/mpeg"}
                    )
                    logger.info(f"[TTS] Uploaded to Supabase: {storage_path}")
                except Exception as e:
                    logger.error(f"[TTS] Supabase upload failed: {e}")
                    return None, False, "UPLOAD_FAILED"

                # 3.10 FINAL RESPONSE
                public_url = self._get_public_url(storage_path)
                return public_url, False, None

        except Exception as e:
            logger.error(f"[TTS] Pipeline error: {e}")
            return None, False, "PIPELINE_ERROR"
