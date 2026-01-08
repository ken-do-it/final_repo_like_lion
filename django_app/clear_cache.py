import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from contents.models import TranslationEntry

def clear_cache():
    count = TranslationEntry.objects.count()
    TranslationEntry.objects.all().delete()
    print(f"Deleted {count} translation entries. Cache cleared!")

if __name__ == '__main__':
    clear_cache()
