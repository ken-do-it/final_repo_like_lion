import os
import sys

# Ensure we can import from the app directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from translation.client import TranslationClient

def test_internal():
    print("Initializing TranslationClient...")
    try:
        client = TranslationClient()
        print(f"Model: {client.model_name}")
        
        text = "성심당"
        src = "kor_Hang"
        tgt = "eng_Latn"
        
        print(f"Translating '{text}' ({src}) -> ({tgt})...")
        result = client.translate(text, src, tgt)
        print(f"Result: {result}")
        
        if "성심당" in result:
             print("[FAIL] Output contains original Korean text.")
        else:
             print("[SUCCESS] Translation seems to have changed the text.")
             
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_internal()
