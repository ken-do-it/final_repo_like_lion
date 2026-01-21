import os
import django
import hashlib

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from contents.models import TranslationEntry

target_text = "제비다방"
src_hash = hashlib.sha256(target_text.encode("utf-8")).hexdigest()

print(f"Text: {target_text}")
print(f"Hash: {src_hash}")
print()

entries = TranslationEntry.objects.filter(source_hash=src_hash)
print(f"Found {entries.count()} entries:")
for e in entries:
    print(f"  {e.target_lang}: {e.translated_text}")
