import os
import sys

# Ensure we can import from the app directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from translation.client import TranslationClient

def test_internal():
print("번역 클라이언트 초기화 중...")
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
print("[실패] 결과에 원본 한국어가 포함되어 있습니다.")
        else:
print("[성공] 번역 결과가 원문과 다르게 변경되었습니다.")
             
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_internal()
