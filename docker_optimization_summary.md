# 🚀 도커 빌드 속도 최적화: 팀 공유 가이드

## 1. 개요
프로젝트 내 AI 관련 서비스들의 **도커 빌드 속도가 너무 느린 문제(15분 이상)**를 해결했습니다.
이제 GPU가 없는 노트북에서도 **2~3분 내에 쾌적하게 빌드**할 수 있습니다.

---

## 2. 변경 사항 (핵심 요약)

### 🅰️ 번역 서버 (`fastapi_ai_translation`)
가장 무거운 서비스로, **"CPU 기본, GPU 옵션"** 전략을 적용했습니다.

| 파일명 | 용도 | 설명 |
| :--- | :--- | :--- |
| **`Dockerfile`** | **기본 (CPU)** | **가벼운 버전.** `start.ps1` 없이 그냥 실행하면 이 파일이 선택됨. (Safe Default) |
| **`Dockerfile.gpu`** | **옵션 (GPU)** | **고성능 버전.** GPU가 있는 컴에서 `start.ps1` 실행 시 자동으로 선택됨. |
| **`requirements.txt`** | **CPU용** | `Dockerfile`에서 사용. CPU 버전의 가벼운 PyTorch 설치. |
| **`requirements.gpu.txt`** | **GPU용** | `Dockerfile.gpu`에서 사용. CUDA 지원 PyTorch 설치. |

### 🅱️ 메인 서버 (`fastapi_app`)
검색 기능에 쓰이는 작은 모델(`sentence-transformers`) 때문에 무거운 GPU 라이브러리가 깔리던 문제를 수정했습니다.

*   **변경점**: `requirements.txt`에 **CPU 버전 명시적 지정** 구문 추가.
    ```text
    --extra-index-url https://download.pytorch.org/whl/cpu
    torch==2.2.2+cpu
    ```
*   **효과**: 
    *   빌드 속도 획기적 단축.
    *   기존 기능(검색, 임베딩)은 **100% 동일하게 동작**함 (CPU로도 충분히 빠름).

---

## 3. 사용 방법 (New Workflow)

모든 팀원은 이제 복잡한 명령어 고민 없이 **아래 스크립트 하나만 기억하세요.**

### ✅ 통합 실행 명령어

### CMD

```markdown
루트 폴터>  powershell ./start.ps1
```

### PowerShell

```powershell
./start.ps1

```

`이렇게 하면 자동으로 도커를 빌드한다`





### ⚙️ 스크립트가 해주는 일
1.  **자동 감지**: 내 컴퓨터에 GPU(`nvidia-smi`)가 있는지 확인합니다.
2.  **자동 선택**:
    *   **GPU 있음** ➔ `fastapi_ai_translation`을 **고성능 GPU 모드**로 실행합니다. 🚀
    *   **GPU 없음** ➔ **경량 CPU 모드**로 실행합니다. (에러 없이 빠름) 🍃
3.  **빌드 & 실행**: 자동으로 `docker-compose up --build`를 수해합니다.

### ⚠️ 주의 (수동 실행 시)
만약 스크립트 없이 `docker-compose up`을 바로 때리면?
*   무조건 **안전한 CPU 모드(Safe Mode)**로 실행됩니다.
*   실수로 무거운 GPU 버전을 빌드해서 시간을 낭비하는 사고를 막기 위함입니다.

---

## 4. 결론
*   **저사양 노트북**: 이제 팬 소음 없이 조용하고 빠르게 개발 가능합니다.
*   **고사양 데스크탑**: `start.ps1` 쓰면 자동으로 풀 파워 성능을 냅니다.
*   **배포**: 배포 서버도 GPU 유무에 따라 스크립트가 알아서 최적의 구성을 찾아줍니다.

---

## 5. 자주 묻는 질문 (FAQ)

### Q. `fastapi_app`에서 CPU 버전 토치를 강제로 깔아도 괜찮은가요?
**A. 네! 전혀 문제없으며 오히려 권장됩니다.**

1.  **호환성 완벽 지원**
    *   `sentence-transformers` 라이브러리는 내부적으로 `torch`를 가져다 쓰는데, **CPU 버전이든 GPU 버전이든 상관없이 작동하도록 설계**되어 있습니다.
    *   설치된 토치가 GPU를 지원하면 GPU로 돌리고, CPU만 지원하면 "아, CPU구나" 하고 자동으로 CPU 모드로 동작합니다. 따라서 에러가 나거나 기능이 동작하지 않는 일은 없습니다.

2.  **우리가 사용하는 모델의 특성**
    *   현재 사용 중인 `paraphrase-multilingual-MiniLM-L12-v2` 모델은 크기가 매우 작습니다 (약 400MB).
    *   이 정도 작은 모델은 CPU로 돌려도 **0.05초 ~ 0.1초**면 결과가 나옵니다.
    *   굳이 수 GB짜리 무거운 GPU 라이브러리를 깔아서 0.01초 단축하는 것보다, **빌드 속도를 10분 단축하고 서버를 가볍게 유지하는 것이 훨씬 이득**입니다.

### 요약
> **"CPU 버전 토치를 깔아도 되나요?"**
> **"네! 무거운 GPU 짐을 내려놓고 가볍게 달리는 것일 뿐, 기능은 100% 똑같이 동작합니다."** 👍

---

## 6. 트러블슈팅 (Troubleshooting)

이 최적화 과정에서 겪었던 시행착오와 해결 방법을 공유합니다.

### 🔴 문제 상황 (The Problem)
처음에 `requirements.txt`에 단순하게 아래와 같이 적었습니다.
```text
torch --index-url https://download.pytorch.org/whl/cpu
```
그러나 실제 빌드된 컨테이너 내부를 확인해보니, **여전히 GPU 버전(`+cu121`)이 설치**되어 있었습니다. 이로 인해 빌드 시간이 단축되지 않았습니다.

### 🔍 원인 분석 (Root Cause)
`pip install` 명령어가 `requirements.txt`를 처리할 때, `--index-url` 옵션이 줄 중간에 있으면 무시되거나, 기본 PyPI 저장소의 패키지(GPU 포함 버전)가 우선순위를 가져가는 현상이 발생했습니다.

### ✅ 해결책 (The Fix)
두 가지 안전장치를 적용하여 문제를 해결했습니다.

1.  **경로 명시 위치 변경**: `--extra-index-url`을 파일 **최상단**에 명시하여 pip가 패키지를 찾을 때 CPU 저장소를 먼저 바라보게 했습니다.
2.  **버전 강제 고정 (Pinning)**: 단순히 `torch`라고 적지 않고, `torch==2.2.2+cpu`와 같이 **`+cpu` 태그를 명시**했습니다. 이렇게 하면 pip가 GPU 버전을 다운로드하고 싶어도 이름이 맞지 않아 다운로드할 수 없게 됩니다.

```text
# [수정된 requirements.txt 예시]
--extra-index-url https://download.pytorch.org/whl/cpu
torch==2.2.2+cpu
```
