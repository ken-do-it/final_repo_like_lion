import requests
import json

def test_search_eng():
    url = "http://localhost:8002/places/search"
    # Testing for "Seongsimdang" (성심당) with English target
    params = {
        "query": "성심당",
        "lang": "eng_Latn"
    }
    try:
        print(f"Testing '성심당' with lang=eng_Latn...")
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data['results']:
                first = data['results'][0]
                print(f"Original Name (assumed): 성심당 본점")
                print(f"Result Name: {first.get('name')}")
                print(f"Result Address: {first.get('address')}")
                
                # Check if translation actually happened
                if "성심당" in first.get('name'):
                    print("[WARN] Name seems untranslated (contains Korean characters)")
                else:
                    print("[SUCCESS] Name appears translated")
            else:
                print("No results found.")
        else:
            print(f"Error: {response.status_code} {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_search_eng()
