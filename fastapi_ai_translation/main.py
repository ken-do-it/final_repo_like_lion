import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from translation.router import router as translation_router, warmup_model
from prometheus_fastapi_instrumentator import Instrumentator
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Translation Service")
Instrumentator().instrument(app).expose(app)

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# [Security] API Key Validation Middleware
# 내부망 호출이라도 최소한의 보안을 위해 API Key를 검증합니다.
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

AI_SERVICE_API_KEY = os.getenv("AI_SERVICE_API_KEY", "secure-api-key-1234")

@app.middleware("http")
async def verify_api_key(request: Request, call_next):
    # Health check endpoints usually don't need auth, but let's secure everything except health for safety
    if request.url.path == "/health" or request.method == "OPTIONS":
        return await call_next(request)

    api_key = request.headers.get("x-ai-api-key")
    if api_key != AI_SERVICE_API_KEY:
        return JSONResponse(
            status_code=403,
            content={"detail": "Invalid or missing API Key"}
        )
    
    response = await call_next(request)
    return response

# Register Translation Router
app.include_router(translation_router, prefix="/api/ai", tags=["translation"])

@app.on_event("startup")
async def startup_event():
    logger.info("AI \uBC88\uC5ED \uC11C\uBE44\uC2A4(\uD3EC\uD2B8 8003) \uC2DC\uC791...")
    # Add any model warm-up logic here if needed
    # The client initializes the model lazily or on import, check client.py behavior
    warmup_model()

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "fastapi_ai_translation"}
