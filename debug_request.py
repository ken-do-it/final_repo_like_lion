import requests

try:
    print("Sending request...")
    resp = requests.get("http://localhost:8000/api/shortforms/?lang=kor_Hang")
    print(f"Status Code: {resp.status_code}")
    print("Response Body Snippet:")
    print(resp.text[:500])
except Exception as e:
    print(f"Request failed: {e}")
