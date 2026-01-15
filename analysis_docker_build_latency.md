# 멋사 마지막 프로젝트 6 번역모델 변경: 도커 빌드 지연 분석

## 1. 문제 인식
- GPU가 없거나 저사양 노트북에서 `docker-compose` 빌드가 과도하게 오래 걸린다.
- 특히 AI 관련 서비스가 포함된 빌드에서 시간이 폭증한다는 피드백이 있다.

## 2. 문제 파악
- **초대형 베이스 이미지 사용**: 번역 서비스가 `pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime`를 사용 중이라 이미지 자체가 매우 크고 다운로드가 오래 걸림. `fastapi_ai_translation/Dockerfile`
- **대용량 패키지 설치**: 번역 서비스 의존성에 `torch`, `transformers`, `sentencepiece`가 포함되어 있어 빌드 시 다운로드/설치 시간이 길다. `fastapi_ai_translation/requirements.txt`
- **다른 서비스도 무거운 AI 의존성 포함**: `fastapi_app`에서 `sentence-transformers`를 사용하며, 이는 내부적으로 `torch` 설치를 유발할 가능성이 높다. `fastapi_app/requirements.txt`, `fastapi_app/main.py`
- **모델 다운로드가 런타임에 발생**: 번역 서버는 `AutoModelForSeq2SeqLM.from_pretrained(...)` 호출로 모델을 처음 실행 시 다운로드함. 저사양 환경에서 첫 실행/캐싱 시간이 크게 늘어남. `fastapi_ai_translation/translation/client.py`
- **모든 서비스가 기본으로 빌드됨**: `docker-compose.yaml`에서 `fastapi-ai-translation`, `fastapi`, `frontend` 등 전부 빌드하도록 되어 있어, 저사양에서도 전체 빌드를 피하기 어렵다. `docker-compose.yaml`
- **프론트엔드 빌드 비용**: `npm install` + `npm run build`가 기본으로 실행되며, 저사양에서 체감 시간이 큼. `frontend/Dockerfile`

## 3. 해결 방법 고민
- **GPU 전용 베이스 이미지 제거**: CPU 전용 PyTorch 이미지 또는 slim Python + CPU-only torch로 전환해 이미지 크기/다운로드 시간을 줄이는 방법.
- **번역 서비스 빌드 분리**: `fastapi-ai-translation`을 기본 빌드에서 제외하고, 필요할 때만 빌드/실행하도록 분리.
- **AI 기능 외부화**: 번역을 로컬 모델 대신 외부 API(OpenAI/외부 번역)로 돌려 빌드 의존성을 최소화.
- **경량 모델 채택**: NLLB 600M 대신 더 작은 모델로 전환해 런타임 다운로드/메모리 사용을 줄이는 방법.
- **프론트엔드 캐싱 최적화**: `npm ci` + 캐시 활용 등 빌드 단계를 개선 (저사양에서 체감 개선).

## 4. 최종 선택 및 이유
- **추천 우선순위**  
  1) 번역 서비스 빌드를 선택적으로 분리  
  2) CPU 전용 이미지로 교체  
  3) 외부 API로 대체  
- **이유**: 저사양 환경에서 가장 큰 병목은 GPU 전용 이미지 + 대용량 PyTorch/Transformers 설치이므로, 이를 기본 빌드에서 제거하거나 경량화하는 것이 체감 효과가 가장 크다. `fastapi_ai_translation/Dockerfile`, `fastapi_ai_translation/requirements.txt`

## 5. 구현 과정 (설계 관점, 코드 작성 없음)
- 번역 서비스용 Dockerfile을 **GPU용/CPU용**으로 분리해 선택적으로 빌드할 수 있는 구조 설계.
- `docker-compose`에서 번역 서비스를 기본에서 제외하거나 프로파일로 분리해 저사양에서는 빌드하지 않도록 구성 설계.
- 번역 엔진을 외부 API로 전환 시, 로컬 모델 의존성을 제거하는 구조 검토.
- `fastapi_app`에서 `sentence-transformers` 사용을 분리하거나 필요 시에만 로딩하는 구조 검토.

## 6. 개선 결과 (예상)
- **빌드 시간 단축**: 대용량 이미지/패키지 다운로드 제거로 수 분~수십 분 단축 가능.
- **초기 실행 안정성 개선**: 모델 다운로드 부담 감소, 저사양에서도 실행 실패율 감소.
- **환경별 유연성 증가**: GPU 환경에서는 고성능 설정을 유지하고, 저사양 환경에서는 경량 구성 사용 가능.

## 7. 기술적 회고
- “모든 환경에서 동일한 스택”은 개발 편의성은 높지만, 실제 배포/학습 환경에서는 비용이 크다.
- AI 기능은 특히 무겁기 때문에 **“옵션형 서비스”로 분리**하는 것이 협업/교육 프로젝트에서 실용적이다.
- 빌드 성능 최적화는 단순 속도 문제가 아니라, **진입 장벽을 낮추는 UX 개선**의 핵심이다.
