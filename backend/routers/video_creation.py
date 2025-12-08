from fastapi import APIRouter, Form, HTTPException, Depends
from backend.database import get_db
from sqlalchemy.orm import Session
from backend import models
from typing import Optional
from backend.services.video_creation import generate_video

router = APIRouter(
    prefix="/video-creation",
    tags=["Video Creation"]
)

@router.post("/generate")
async def generate(
    prompt: str = Form(...),
    aspect_ratio: str = Form("16:9"),
    quality: str = Form("speed"), # speed or quality
    project_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        blob_name = await generate_video(prompt, aspect_ratio=aspect_ratio, quality=quality)
        
        from backend.services.storage import generate_signed_url
        video_url = generate_signed_url(blob_name)
        
        return {"video_url": video_url, "blob_name": blob_name}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save")
async def save_video_asset(
    project_id: int = Form(...),
    blob_name: str = Form(...),
    prompt: str = Form(...),
    context_data: Optional[str] = Form(None),
    context_version: Optional[str] = Form(None),
    model_type: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        asset = models.Asset(
            project_id=project_id,
            type="video",
            url=blob_name,
            prompt=prompt,
            context_data=context_data,
            context_version=context_version,
            model_type=model_type
        )
        db.add(asset)
        db.commit()
        return {"message": "Video saved successfully", "asset_id": asset.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


