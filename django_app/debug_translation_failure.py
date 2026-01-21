import os
import django
import time

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from contents.models import TranslationEntry
from contents.services.translation_service import TranslationService

def debug_failure():
    target_text = "농민백암순대 본점"
    target_lang = "eng_Latn"
    
    print(f"--- Debugging Translation for: '{target_text}' -> {target_lang} ---")
    
    # 1. Check Cache
    entries = TranslationEntry.objects.filter(target_lang=target_lang)
    found = False
    for entry in entries:
        # Check source hash or just rudimentary text match if stored (source text isn't stored directly, only hash)
        # But we can check translated_text.
        if entry.translated_text == target_text:
             print(f"[CACHE FOUND - BAD] ID: {entry.id}, Translated: {entry.translated_text} (Same as source!)")
             found = True
             # We can try to hash the source and see if it matches
             import hashlib
             src_hash = hashlib.sha256(target_text.encode("utf-8")).hexdigest()
             if entry.source_hash == src_hash:
                 print("  -> Source Hash Matches! This is definitely the cached entry.")
    
    if not found:
        print("[CACHE] No exact 'Same-as-source' Bad Entry found in cache (checking hashes now...)")
        import hashlib
        src_hash = hashlib.sha256(target_text.encode("utf-8")).hexdigest()
        entry = TranslationEntry.objects.filter(source_hash=src_hash, target_lang=target_lang).first()
        if entry:
            print(f"[CACHE FOUND - BY HASH] ID: {entry.id}, Translated: '{entry.translated_text}'")
        else:
            print("[CACHE] Not found in cache by hash.")

    # 2. Live Translation Test
    print("\n--- Attempting Live Translation ---")
    try:
        # Simulate list input as used in views
        result, provider = TranslationService.call_fastapi_translate_batch([target_text], "kor_Hang", target_lang)
        print(f"Result: {result}")
        print(f"Provider: {provider}")
    except Exception as e:
        print(f"Live Translation Failed: {e}")

if __name__ == "__main__":
    debug_failure()
