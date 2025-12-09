from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict
from backend.services.video_magic import generate_script, edit_script

router = APIRouter(
    prefix="/video-magic",
    tags=["video-magic"]
)

class ScriptRequest(BaseModel):
    prompt: str
    context: Optional[str] = None

class EditScriptRequest(BaseModel):
    current_script: List[Dict[str, str]]
    instructions: str

@router.post("/script/generate")
async def generate_video_script(request: ScriptRequest):
    try:
        script = await generate_script(request.prompt, request.context)
        return {"script": script}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/script/edit")
async def edit_video_script(request: EditScriptRequest):
    try:
        script = await edit_script(request.current_script, request.instructions)
        return {"script": script}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
