import os
import logging
from openai import OpenAI

logger = logging.getLogger("uvicorn")

class OpenAIAdapter:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY \uD658\uACBD \uBCC0\uC218\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.")
        self.client = OpenAI(api_key=self.api_key, timeout=30.0) # 30초 타임아웃 설정
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini") # Default to cost-effective 4o-mini
        
        logger.info(f"OpenAI Adapter initialized with model: {self.model}")

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        """
        Translates a single text using OpenAI.
        """
        try:
            system_prompt = self._get_system_prompt(target_lang)
            user_prompt = f"Source Language: {source_lang}\nText: {text}"

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3, # Lower temperature for accuracy
                max_tokens=256
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"OpenAI Translation Error: {e}")
            raise e

    def translate_batch(self, texts: list[str], source_lang: str, target_lang: str) -> list[str]:
        """
        Translates a batch of texts.
        """
        try:
            system_prompt = self._get_system_prompt(target_lang)
            system_prompt += "\n\nIMPORTANT: Return ONLY the translated texts, one per line. Do not include numbering or bullet points."
            
            # Join texts with newlines
            user_prompt = f"Source: {source_lang}\nTranslate these items (keep order):\n" + "\n".join(texts)
            
            print(f"DEBUG: OpenAI Prompt: {user_prompt}", flush=True)

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1, # Lower temperature for accuracy
                timeout=30.0
            )
            
            result_text = response.choices[0].message.content.strip()
            print(f"DEBUG: OpenAI Response: {result_text}", flush=True)
            
            # Try to parse as JSON first (fallback if OpenAI ignores instructions)
            translations = []
            if result_text.startswith('{') or result_text.startswith('['):
                try:
                    import json
                    parsed = json.loads(result_text)
                    if isinstance(parsed, dict) and "translations" in parsed:
                        translations = parsed["translations"]
                    elif isinstance(parsed, list):
                        translations = parsed
                    else:
                        logger.warning(f"Unexpected JSON format: {result_text}")
                except json.JSONDecodeError:
                    logger.warning("JSON 응답 파싱 실패, 라인 파싱으로 대체합니다.")
            
            # If JSON parsing failed or wasn't JSON, parse line by line
            if not translations:
                translations = [line.strip() for line in result_text.split('\n') if line.strip()]
            
            # Validate count
            if len(translations) != len(texts):
                logger.warning(f"Translation count mismatch: Expected {len(texts)}, got {len(translations)}. Padding/Truncating.")
                # Pad with original if too short
                while len(translations) < len(texts):
                    translations.append(texts[len(translations)])
                # Truncate if too long
                translations = translations[:len(texts)]
            
            # CRITICAL: Ensure all elements are strings
            translations = [str(t) if t is not None else "" for t in translations]
                
            return translations
                
        except Exception as e:
            logger.error(f"OpenAI Batch Translation Error: {e}", exc_info=True)
            return texts

    def _map_lang_code(self, code: str) -> str:
        mapping = {
            "kor_Hang": "Korean",
            "eng_Latn": "English",
            "jpn_Jpan": "Japanese",
            "zho_Hans": "Simplified Chinese",
            "zho_Hant": "Traditional Chinese",
        }
        return mapping.get(code, code)

    def _get_system_prompt(self, target_lang: str) -> str:
        target_lang_name = self._map_lang_code(target_lang)
        return (
             f"You are a professional translator specializing in Korean Travel Content.\n"
             f"Translate the given text into {target_lang_name}.\n\n"
             f"Rules:\n"
             f"1. **Accuracy is paramount.** Do not hallucinate city names or places.\n"
             f"2. **Script Enforcement (for CJK languages only):** If translating to Japanese/Chinese, use the appropriate script (Kanji/Kana for Japanese, Hanzi for Chinese). Do NOT use Romanization for these languages.\n"
             f"3. **For English:** Translate Korean text into natural English. Proper nouns can be transliterated (e.g., 'Jebidabang Cafe').\n"
             f"4. **No Explanations:** Return ONLY the translated text.\n"
             f"5. **Batch Requests:** Return a strictly valid JSON object: {{ \"translations\": [ \"string1\", \"string2\" ] }}"
        )
