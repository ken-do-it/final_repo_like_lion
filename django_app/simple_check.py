import os
import django
import hashlib

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from contents.models import TranslationEntry

target_text = "농민백암순대 본점"
src_hash = hashlib.sha256(target_text.encode("utf-8")).hexdigest()

print(f"Hash: {src_hash}")
print()

entries = TranslationEntry.objects.filter(source_hash=src_hash)
for e in entries:
    print(f"{e.id} | {e.target_lang} | {e.translated_text[:50]}")
