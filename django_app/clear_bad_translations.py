
import os
import django
import re

# Django 환경 설정
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from contents.models import TranslationEntry
from django.db.models import Q

def clean_bad_translations():
    print("--- Cleaning Bad Translations (English in Non-English Targets) ---")
    
    # Target languages that should NOT have English (Japanese, Chinese)
    # Note: 'kor_Hang' might technically have English for brands, but we want to force transliteration if possible.
    # For now, focus on Japanese and Chinese as reported.
    target_langs = ['jpn_Jpan', 'zho_Hans', 'zho_Hant']
    
    # Delete entries where target_lang is in the list AND text contains ASCII letters
    # We fetch and check in python because regex filter in DB might be DB-specific (though Django supports it).
    # For safety and simple logic, let's iterate or use simple contains.
    
    entries = TranslationEntry.objects.filter(target_lang__in=target_langs)
    
    deleted_count = 0
    bad_ids = []
    
    for entry in entries:
        # Check if text contains [a-zA-Z]
        if re.search(r'[a-zA-Z]', entry.translated_text):
            # Exception: Maybe some extremely short strings? No, "Daejeon" is ASCII.
            bad_ids.append(entry.id)
            print(f"[Deleting] ID {entry.id} ({entry.target_lang}): {entry.translated_text}")
    
    if bad_ids:
        # Batch delete
        TranslationEntry.objects.filter(id__in=bad_ids).delete()
        print(f"--- Deleted {len(bad_ids)} bad entries. ---")
    else:
        print("--- No bad entries found. ---")

if __name__ == "__main__":
    clean_bad_translations()
