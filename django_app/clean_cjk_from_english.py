import os
import django
import re

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from contents.models import TranslationEntry

def clean_cjk_from_english():
    print("--- Cleaning CJK Characters from English Cache ---")
    
    # CJK Unified Ideographs (Chinese/Japanese Kanji)
    cjk_pattern = re.compile(r'[\u4e00-\u9fff\u3400-\u4dbf]')
    
    # Hiragana/Katakana (Japanese)
    kana_pattern = re.compile(r'[\u3040-\u309f\u30a0-\u30ff]')
    
    entries = TranslationEntry.objects.filter(target_lang='eng_Latn')
    
    bad_ids = []
    
    for entry in entries:
        has_cjk = cjk_pattern.search(entry.translated_text)
        has_kana = kana_pattern.search(entry.translated_text)
        
        if has_cjk or has_kana:
            bad_ids.append(entry.id)
            print(f"[Deleting] ID {entry.id}: {entry.translated_text[:60]}")
    
    if bad_ids:
        TranslationEntry.objects.filter(id__in=bad_ids).delete()
        print(f"\n--- Deleted {len(bad_ids)} bad English entries. ---")
    else:
        print("--- No bad entries found. ---")

if __name__ == "__main__":
    clean_cjk_from_english()
