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
        Uses a creative prompt for titles.
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
                temperature=0.7, # Slightly creative
                max_tokens=256
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"OpenAI Translation Error: {e}")
            raise e

    def translate_batch(self, texts: list[str], source_lang: str, target_lang: str) -> list[str]:
        """
        Translates a batch of texts.
        To save tokens/requests, we send them as a list in one prompt.
        """
        try:
            system_prompt = self._get_system_prompt(target_lang)
            system_prompt += "\n\nIMPORTANT: Return ONLY a JSON list of translated strings. Example: [\"Trans1\", \"Trans2\"]"
            
            # Join texts with a separator or just send as JSON string
            import json
            user_prompt = f"Source: {source_lang}\nTranslate these items:\n{json.dumps(texts, ensure_ascii=False)}"

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                response_format={"type": "json_object"}
            )
            
            result_json = response.choices[0].message.content
            # Expecting explicit JSON object with a key 'translations' or just a list?
            # Let's force a structured output in prompt if possible, or parse carefully.
            # 4o-mini supports json_object. Let's ask for {"translations": ["..."]}
            
            parsed = json.loads(result_json)
            if "translations" in parsed and isinstance(parsed["translations"], list):
                return parsed["translations"]
            elif isinstance(parsed, list):
                return parsed
            else:
                # Fallback: maybe just try line by line split if JSON fails?
                # But json_object mode enforces JSON.
                logger.error(f"Unexpected JSON format: {result_json}")
                return texts # Fallback to original
                
        except Exception as e:
            logger.error(f"OpenAI Batch Translation Error: {e}")
            # Fallback to single loop if batch fails? Or just return originals
            return texts

    def _get_system_prompt(self, target_lang: str) -> str:
        return (
            f"You are a professional YouTube Global Creator.\n"
            f"Translate the given text into {target_lang}.\n"
            f"1. If the text looks like a Title, make it CATCHY, CLICKBAITY, and NATURAL for YouTube.\n"
            f"   (e.g., 'Make Kimchi' -> 'How to Make Authentic Kimchi at Home! 🌶️')\n"
            f"2. If it is description/content, translate it naturally.\n"
            f"3. Do not add explanations, just return the translation.\n"
            f"4. For batch requests, return JSON object: {{ \"translations\": [ ... ] }}"
        )
