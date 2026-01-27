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
        Ollama를 사용하여 단일 텍스트를 번역합니다.
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
                        "temperature": 0.7, # 창의성 (Creativity)
                        "num_predict": 100
                    }
                },
                timeout=timeout
            )
            response.raise_for_status()
            result = response.json()
            translated_text = result.get("response", "").strip()
            
            # 모델이 따옴표나 설명을 출력하는 경우 기본 정리
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
        텍스트 목록을 번역합니다.
        참고: LLM은 느리므로 배치 처리는 순차적 또는 병렬 스레드로 수행됩니다.
        여기서는 단순성과 안정성을 위해 순차적으로 처리합니다.
        """
        results = []
        for t in texts:
            try:
                results.append(self.translate(t, source_lang, target_lang))
            except Exception:
                results.append(t) # Fallback to original on error
        return results

    def _build_prompt(self, text: str, src: str, tgt: str) -> str:
        # 더 나은 프롬프팅을 위한 단순 매핑
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

        # 유튜브 쇼츠를 위한 프롬프트 엔지니어링
        return (
            f"You are a professional multi-lingual YouTube content creator. "
            f"Your task is to translate the following short video title from {src_name} to {tgt_name}. "
            f"The translation must be natural, catchy, and appealing to {tgt_name} speakers. "
            f"Do NOT give explanations. Output ONLY the translated text.\n\n"
            f"Original: {text}\n"
            f"Translation:"
        )

    def _clean_output(self, text: str) -> str:
        # 존재하는 경우 주변 따옴표 제거
        if text.startswith('"') and text.endswith('"'):
            text = text[1:-1]
        return text
