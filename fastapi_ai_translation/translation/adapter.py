import os
import requests
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

class OllamaAdapter:
    """Adapter for Local LLM (Ollama) translation."""

    def __init__(self):
        self.ollama_url = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")
        self.model_name = os.getenv("OLLAMA_MODEL", "llama3")
        logger.info(f"Initialized OllamaAdapter with URL={self.ollama_url}, Model={self.model_name}")

    def translate(self, text: str, source_lang: str, target_lang: str, timeout: int = 60) -> str:
        """
        Translate a single text using Ollama.
        """
        if not text or not text.strip():
            return ""

        prompt = self._build_prompt(text, source_lang, target_lang)
        
        try:
            response = requests.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7, # Creativity
                        "num_predict": 100
                    }
                },
                timeout=timeout
            )
            response.raise_for_status()
            result = response.json()
            translated_text = result.get("response", "").strip()
            
            # Basic cleanup if model outputs quotes or explanation
            translated_text = self._clean_output(translated_text)
            return translated_text

        except requests.exceptions.RequestException as e:
            logger.error(f"Ollama request failed: {e}")
            raise Exception(f"Ollama connection error: {e}")
        except Exception as e:
            logger.error(f"Ollama translation error: {e}")
            raise

    def translate_batch(self, texts: List[str], source_lang: str, target_lang: str) -> List[str]:
        """
        Translate a list of texts. 
        Note: LLMs are slow, so batch processing is done sequentially or in parallel threads.
        Here we do sequential for simplicity and reliability.
        """
        results = []
        for t in texts:
            try:
                results.append(self.translate(t, source_lang, target_lang))
            except Exception:
                results.append(t) # Fallback to original on error
        return results

    def _build_prompt(self, text: str, src: str, tgt: str) -> str:
        # Simple mapping for better prompting
        lang_names = {
            "kor_Hang": "Korean",
            "eng_Latn": "English",
            "jpn_Jpan": "Japanese",
            "zho_Hans": "Chinese",
            "kor": "Korean",
            "eng": "English",
            "jpn": "Japanese"
        }
        
        src_name = lang_names.get(src, src)
        tgt_name = lang_names.get(tgt, tgt)

        # Prompt Engineering for YouTube Shorts
        return (
            f"You are a professional multi-lingual YouTube content creator. "
            f"Your task is to translate the following short video title from {src_name} to {tgt_name}. "
            f"The translation must be natural, catchy, and appealing to {tgt_name} speakers. "
            f"Do NOT give explanations. Output ONLY the translated text.\n\n"
            f"Original: {text}\n"
            f"Translation:"
        )

    def _clean_output(self, text: str) -> str:
        # Remove surrounding quotes if present
        if text.startswith('"') and text.endswith('"'):
            text = text[1:-1]
        return text
