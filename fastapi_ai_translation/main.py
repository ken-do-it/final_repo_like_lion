import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from translation.router import router as translation_router
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

# Register Translation Router
app.include_router(translation_router, prefix="/api/ai", tags=["translation"])

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 AI Translation Service (Port 8003) Starting...")
    # Add any model warm-up logic here if needed
    # The client initializes the model lazily or on import, check client.py behavior
    pass

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "fastapi_ai_translation"}
