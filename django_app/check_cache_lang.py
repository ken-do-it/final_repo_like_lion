import os
import django
import hashlib

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from contents.models import TranslationEntry

def check_cache_lang_codes():
    target_text = "농민백암순대 본점"
    src_hash = hashlib.sha256(target_text.encode("utf-8")).hexdigest()
    
    output = []
    output.append(f"--- Checking Cache for: '{target_text}' ---")
    output.append(f"Source Hash: {src_hash}\n")
    
    # Find all entries with this source hash
    entries = TranslationEntry.objects.filter(source_hash=src_hash)
    
    if not entries.exists():
        output.append("No cache entries found for this text.")
    else:
        output.append(f"Found {entries.count()} cache entries:\n")
        for entry in entries:
            output.append(f"ID: {entry.id}")
            output.append(f"  Target Lang: {entry.target_lang}")
            output.append(f"  Translated: {entry.translated_text}")
            output.append(f"  Provider: {entry.provider}")
            output.append(f"  Model: {entry.model}")
            output.append(f"  Created: {entry.created_at}")
            output.append("")
    
    result = "\n".join(output)
    print(result)
    
    # Also write to file
    with open("/tmp/cache_check.txt", "w", encoding="utf-8") as f:
        f.write(result)

if __name__ == "__main__":
    check_cache_lang_codes()
