import httpx
import asyncio
import json

async def reproduce_search_issue_english():
    # Use localhost:8002 where FastAPI is running
    base_url = "http://localhost:8002/places/search"
    query = "성심당" # Korean query

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Search in English
        print("\n--- 1. Searching in English (lang=eng_Latn) ---")
        try:
            resp_en = await client.get(base_url, params={"query": query, "lang": "eng_Latn"})
            if resp_en.status_code == 200:
                results = resp_en.json()['results']
                if results:
                    first_name = results[0]['name']
                    first_addr = results[0]['address']
                    print(f"First Result Name: {first_name}")
                    print(f"First Result Addr: {first_addr}")
                    
                    # Validation: Should NOT be Korean
                    is_hangul = any(ord(c) >= 0xAC00 and ord(c) <= 0xD7A3 for c in first_name)
                    if is_hangul:
                         print("❌ FAILURE: Returned Name contains Hangul (Korean)!")
                    else:
                         print("✅ SUCCESS: Returned Name appears to be translated (No Hangul).")

                else:
                    print("No results found.")
            else:
                print(f"Error: {resp_en.status_code}")
                print(resp_en.text)
        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(reproduce_search_issue_english())
