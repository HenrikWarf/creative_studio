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
    project_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        blob_name = await generate_video(prompt)
        
        if project_id:
            asset = models.Asset(
                project_id=project_id,
                type="video",
                url=blob_name,
                prompt=prompt
            )
            db.add(asset)
            db.commit()
            
        from backend.services.storage import generate_signed_url
        signed_url = generate_signed_url(blob_name)

        return {"video_url": signed_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
