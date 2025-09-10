from fastapi import FastAPI
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

from fastapi.middleware.cors import CORSMiddleware
from backend.api.groq import router as groq_router
import os

app = FastAPI()
print("Loaded GROQ_API_KEY:", os.getenv("GROQ_API_KEY"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Groq API router
app.include_router(groq_router, prefix="/api")