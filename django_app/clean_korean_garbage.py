import os
import django
import re

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from contents.models import TranslationEntry

def clean_korean_garbage():
    print("--- Cleaning Korean Garbage in Non-Korean Translations ---")
    
    # Target languages that SHOULD NOT have Korean text
    # eng_Latn, jpn_Jpan, zho_Hans, zho_Hant
    non_korean_targets = ['eng_Latn', 'jpn_Jpan', 'zho_Hans', 'zho_Hant']
    
    entries = TranslationEntry.objects.filter(target_lang__in=non_korean_targets)
    
    # Hangul Regex (Syllables and Jamo)
    hangul_pattern = re.compile(r'[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f]')
    
    bad_ids = []
    
    for entry in entries:
        if hangul_pattern.search(entry.translated_text):
            bad_ids.append(entry.id)
            print(f"[Deleting] ID {entry.id} (Target: {entry.target_lang}): {entry.translated_text}")
    
    if bad_ids:
        TranslationEntry.objects.filter(id__in=bad_ids).delete()
        print(f"--- Deleted {len(bad_ids)} bad entries. ---")
    else:
        print("--- No bad entries found. ---")

if __name__ == "__main__":
    clean_korean_garbage()
