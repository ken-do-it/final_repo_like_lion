import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from contents.services.translation_service import TranslationService

# List of texts that need English translation
texts_to_translate = [
    "제비다방",
    "알베르",
    "청와대 사랑채",
    "YTN서울타워",
    "롯데월드 어드벤처",
    "경복궁",
    "북한산둘레길 1구간소나무숲길",
    "우와 홍대본점",
    "버드나무집 서초본점",
    "카페1953위드오드리",
    "카몽",
    "학림다방"
]

print("--- Force Translating to English ---")
print(f"Translating {len(texts_to_translate)} items...\n")

try:
    results, provider = TranslationService.call_fastapi_translate_batch(
        texts_to_translate, 
        "kor_Hang", 
        "eng_Latn"
    )
    
    print(f"Provider: {provider}\n")
    for i, (original, translated) in enumerate(zip(texts_to_translate, results)):
        print(f"{i+1}. {original} -> {translated}")
        
except Exception as e:
    print(f"Error: {e}")
