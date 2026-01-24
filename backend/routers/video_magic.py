
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, BackgroundTasks
from typing import List, Optional
from backend.services.video_magic import generate_script, edit_script, generate_image_to_video, optimize_image_prompt, generate_video_first_last
from backend.services.storage import upload_bytes
from backend.schemas import AssetCreate
import json

router = APIRouter(
    prefix="/api/video-magic",
    tags=["video-magic"],
    responses={404: {"description": "Not found"}},
)

@router.post("/script")
async def create_video_script(
    prompt: str = Form(...),
    context: Optional[str] = Form(None)
):
    try:
        script = await generate_script(prompt, context)
        return script
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/script/edit")
async def edit_video_script(
    current_script: str = Form(...), # JSON string
    instructions: str = Form(...)
):
    try:
        script_json = json.loads(current_script)
        script = await edit_script(script_json, instructions)
        return script
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/image-to-video")
async def create_image_to_video(
    image: UploadFile = File(...),
    prompt: str = Form(...),
    context: Optional[str] = Form(None),
    num_videos: int = Form(1),
    project_id: Optional[int] = Form(None)
):
    try:
        results = await generate_image_to_video(image, prompt, context, num_videos)
        
        # Save assets if project_id is provided
        if project_id:
            for res in results:
                # We can't access db directly easily here unless we depend on it, 
                # but we can reuse the asset router logic or just return the data for frontend to save?
                # The video generation might take a while, so this endpoint might be better as background task?
                # For now, we return results.
                pass
                
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/optimize-prompt")
async def optimize_prompt(
    image: UploadFile = File(...),
    instructions: str = Form(...)
):
    try:
        optimized_prompt = await optimize_image_prompt(image, instructions)
        return {"optimized_prompt": optimized_prompt}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/first-last")
async def create_first_last_video(
    first_image: UploadFile = File(...),
    last_image: UploadFile = File(...),
    prompt: str = Form(...),
    context: Optional[str] = Form(None),
    num_videos: int = Form(1)
):
    try:
        result = await generate_video_first_last(first_image, last_image, prompt, context, num_videos)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
