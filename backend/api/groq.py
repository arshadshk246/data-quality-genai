from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from backend import config 


router = APIRouter()


class GroqRequest(BaseModel):
    messages: list[dict]

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions" 


# @router.get('/')
# async def hello():
#     return {"message": "Backend is working"}

@router.post("/groq-chat")
async def groq_chat_completion(request: GroqRequest):

    headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {config.GROQ_API_KEY}",
    }
    payload = {
        "model": "openai/gpt-oss-20b",
        "messages": request.messages,
        "max_completion_tokens": 1024,
        "temperature": 0.7,
        "top_p": 1,
        "stream": False,
        "reasoning_effort": "medium",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(config.GROQ_API_URL, headers=headers, json=payload)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        data = resp.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return {"response": content}
