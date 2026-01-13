# """
# OpenRouter API 테스트
# Django 프로젝트와 독립적으로 실행
# """
# import os
# from openai import OpenAI
# from dotenv import load_dotenv

# env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
# print(f"📁 .env 경로: {env_path}")
# print(f"📁 파일 존재: {os.path.exists(env_path)}\n")

# # .env 로드
# load_dotenv(env_path)

# # OpenRouter 클라이언트 생성
# client = OpenAI(
#     base_url="https://openrouter.ai/api/v1",
#     api_key=os.getenv('OPENROUTER_API_KEY'),
# )

# print("🚀 OpenRouter API 테스트 시작...\n")

# try:
#     # AI 호출
#     completion = client.chat.completions.create(
#         model="google/gemini-flash-1.5-8b",  # 무료 모델
#         messages=[
#             {
#                 "role": "user",
#                 "content": "안녕하세요! 간단한 테스트입니다. '성공!'이라고만 답해주세요."
#             }
#         ],
#         temperature=0.7,
#         max_tokens=100,
#     )
    
#     # 응답 출력
#     response_text = completion.choices[0].message.content
#     print("✅ API 호출 성공!")
#     print(f"📝 응답: {response_text}\n")
    
#     # 토큰 사용량
#     print("📊 토큰 사용량:")
#     print(f"  - Prompt: {completion.usage.prompt_tokens}")
#     print(f"  - Completion: {completion.usage.completion_tokens}")
#     print(f"  - Total: {completion.usage.total_tokens}\n")
    
#     print("🎉 모든 테스트 통과!")
    
# except Exception as e:
#     print("❌ 에러 발생!")
#     print(f"📝 에러 내용: {str(e)}\n")
#     print("💡 확인 사항:")
#     print("  1. .env 파일에 OPENROUTER_API_KEY가 있는지")
#     print("  2. API 키가 올바른지")
#     print("  3. 인터넷 연결이 되는지")

import os
from openai import OpenAI
from dotenv import load_dotenv
import time

# .env 로드
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

api_key = os.getenv('OPENROUTER_API_KEY')

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=api_key,
)

# 테스트할 모델 목록
models_to_test = [
    "mistralai/devstral-2512:free",  # ✅ 이미 성공
    "nvidia/nemotron-nano-9b-v2:free",
    "arcee-ai/trinity-mini:free",
    "xiaomi/mimo-v2-flash:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "nex-agi/deepseek-v3.1-nex-n1:free",
    "tngtech/tng-r1t-chimera:free",
    "kwaipilot/kat-coder-pro:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "openai/gpt-oss-120b:free",
]

print("🚀 전체 모델 테스트 시작...\n")
print("="*60)

successful_models = []
failed_models = []

test_prompt = "제주도 3일 여행 일정을 간단히 추천해주세요. (1-2문장)"

for i, model in enumerate(models_to_test, 1):
    print(f"\n[{i}/{len(models_to_test)}] 테스트: {model}")
    print("-"*60)
    
    try:
        start_time = time.time()
        
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": test_prompt
                }
            ],
            temperature=0.7,
            max_tokens=150,
        )
        
        elapsed = time.time() - start_time
        response = completion.choices[0].message.content
        tokens = completion.usage.total_tokens
        
        print(f"✅ 성공! (응답 시간: {elapsed:.1f}초)")
        print(f"📝 응답: {response[:100]}...")
        print(f"📊 토큰: {tokens}")
        
        successful_models.append({
            'model': model,
            'time': elapsed,
            'tokens': tokens,
            'response': response
        })
        
    except Exception as e:
        error_msg = str(e)[:100]
        print(f"❌ 실패: {error_msg}...")
        failed_models.append(model)
    
    # API 제한 방지
    time.sleep(1)

# 결과 요약
print("\n" + "="*60)
print("📊 테스트 결과 요약")
print("="*60)

if successful_models:
    print(f"\n✅ 성공한 모델: {len(successful_models)}개\n")
    
    # 응답 시간 순으로 정렬
    successful_models.sort(key=lambda x: x['time'])
    
    for i, result in enumerate(successful_models, 1):
        print(f"{i}. {result['model']}")
        print(f"   ⏱️  응답 시간: {result['time']:.1f}초")
        print(f"   📊 토큰: {result['tokens']}")
        print(f"   📝 응답: {result['response'][:80]}...")
        print()
    
    print("\n🎯 추천 모델 (빠른 순):")
    for i, result in enumerate(successful_models[:3], 1):
        print(f"{i}. {result['model']} ({result['time']:.1f}초)")

else:
    print("\n❌ 성공한 모델이 없습니다.")

if failed_models:
    print(f"\n❌ 실패한 모델: {len(failed_models)}개")
    for model in failed_models[:5]:
        print(f"  - {model}")
    if len(failed_models) > 5:
        print(f"  ... 외 {len(failed_models) - 5}개")

print("\n" + "="*60)
print("🎉 테스트 완료!")