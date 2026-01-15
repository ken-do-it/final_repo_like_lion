# NVIDIA Riva-Translate-4B 적용 계획서 (수정)

## 1. 질문에 대한 답변 (Q&A)
**Q: .env 파일에 모델명만 `nvidia/Riva-Translate...`로 바꾸면 되나요?**
**A: 아니요, 불가능합니다.** 🙅‍♂️

이유는 다음과 같습니다:
1.  **동작 방식의 차이:** 기존 모델(NLLB)은 단순히 문장을 넣으면 번역이 나오지만, NVIDIA Riva 모델은 **"Instruct(지시)" 방식**이라서 채팅하듯이 **프롬프트(명령어)** 를 만들어 넣어줘야 합니다.
    *   *NLLB:* "안녕하세요" -> (번역기) -> "Hello"
    *   *NVIDIA Riva:* "Translate this to English: \n 안녕하세요" -> (AI) -> "Hello"
2.  **코드 호환성:** 현재 코드는 NLLB 모델에 최적화된 `NllbTokenizer`를 사용하고 있어, NVIDIA 모델을 그냥 넣으면 에러가 발생하거나 엉뚱한 결과가 나옵니다.

---

## 2. 해결 방안 (Solution)

기존 코드를 망가뜨리지 않고 안전하게 추가하기 위해 **"NVIDIA 전용 어댑터(Adapter)"** 를 새로 만드는 방식을 제안합니다.

### 옵션 비교
*   **옵션 A: 기존 코드(`client.py`) 덕지덕지 수정**
    *   NLLB 로직과 NVIDIA 로직이 섞여서 코드가 복잡해짐. 나중에 에러 찾기 힘듦.
*   **옵션 B: `NvidiaAdapter` 별도 생성 (추천 ⭐)**
    *   `openai_adapter.py` 처럼 NVIDIA용 파일을 따로 만듦.
    *   설정에서 `AI_ENGINE=nvidia`라고 하면 깔끔하게 이 파일이 작동함.

---

## 3. 상세 구현 계획 (Implementation Steps)

### 3.1 `fastapi_ai_translation/translation/nvidia_adapter.py` 생성
이 파일에 NVIDIA 모델을 위한 특별한 로직(프롬프트 생성, GPU 설정 등)을 담습니다.

```python
# (예시 로직)
prompt = f"Translate the following text from {src} to {tgt}:\n{text}"
inputs = tokenizer(prompt, ...).to("cuda")
```

### 3.2 `router.py` 연결
`AI_ENGINE` 환경변수가 `nvidia`일 때, 위에서 만든 어댑터를 사용하도록 연결합니다.

```python
# router.py
engine = os.getenv("AI_ENGINE")
if engine == "nvidia":
    client = NvidiaAdapter()
```

### 3.3 `.env` 설정 변경
마지막으로 사용자께서 말씀하신 대로 `.env`를 수정합니다.

```ini
AI_ENGINE=nvidia
HF_MODEL=nvidia/Riva-Translate-4B-Instruct-v1.1
```

## 4. 모델 스위칭 가이드 (나중에 변경하는 법) - **질문 답변**

네, 맞습니다! **`.env` 파일이 스위치 역할**을 하게 됩니다. 코드를 건드리지 않고 환경변수만 바꾸면 됩니다.

**[옵션 B 적용 후 사용법]**

**1. NVIDIA Riva (새로 추가됨)**
```ini
AI_ENGINE=nvidia
HF_MODEL=nvidia/Riva-Translate-4B-Instruct-v1.1
```

**2. OpenAI (GPT)**
```ini
AI_ENGINE=openai
OPENAI_MODEL=gpt-4o-mini
```

**3. Ollama (로컬 LLM)**
```ini
AI_ENGINE=ollama
OLLAMA_MODEL=llama3
```

**4. NLLB (기존 버전)**
```ini
AI_ENGINE=nllb
HF_MODEL=facebook/nllb-200-distilled-600M
```

---

## 5. 승인 요청
위와 같이 **"코드 수정 + 어댑터 추가"** 방식으로 진행해도 될까요?
승인해 주시면 **전용 어댑터 파일 생성**부터 바로 시작 하겠습니다.
