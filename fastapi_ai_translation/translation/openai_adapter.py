import os
import logging
from openai import OpenAI

logger = logging.getLogger("uvicorn")

class OpenAIAdapter:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set.")
        
        self.client = OpenAI(api_key=self.api_key)
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
            system_prompt += "\n\nIMPORTANT: Return ONLY a JSON list of translated strings. Example: [\"Trans1\", \"Trans2\"]"
            
            # Join texts with a separator or just send as JSON string
            import json
            user_prompt = f"Source: {source_lang}\nTranslate these items:\n{json.dumps(texts, ensure_ascii=False)}"
            
            print(f"DEBUG: OpenAI Prompt: {user_prompt}", flush=True)

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1, # Lower temperature for accuracy
                response_format={"type": "json_object"}
            )
            
            result_json = response.choices[0].message.content
            print(f"DEBUG: OpenAI Response: {result_json}", flush=True)
            
            parsed = json.loads(result_json)
            if "translations" in parsed and isinstance(parsed["translations"], list):
                return parsed["translations"]
            elif isinstance(parsed, list):
                return parsed
            else:
                logger.error(f"Unexpected JSON format: {result_json}")
                return texts # Fallback to original
                
        except Exception as e:
            logger.error(f"OpenAI Batch Translation Error: {e}")
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
             f"2. **Proper Nouns:** **Transliterate** specific brand names (e.g., 'Seongsimdang') and place names into the target language's script. **DO NOT** keep Korean characters if the target is English/Alphabet.\n"
             f"3. **Titles:** Make them natural and engaging, but DO NOT alter the meaning.\n"
             f"   (e.g., '대전 성심당' -> 'Daejeon Seongsimdang Bakery')\n"
             f"4. **No Explanations:** Return ONLY the translated text.\n"
             f"5. **Batch Requests:** Return a strictly valid JSON object: {{ \"translations\": [ \"string1\", \"string2\" ] }}"
        )
