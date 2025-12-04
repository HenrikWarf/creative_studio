from fastapi import APIRouter, File, UploadFile, HTTPException, Form, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend import models
from fastapi.responses import JSONResponse
from backend.services.virtual_tryon import process_virtual_try_on
import shutil
import os
import uuid
from typing import Optional
from backend.services.storage import generate_signed_url

router = APIRouter(
    prefix="/virtual-try-on",
    tags=["Virtual Try-on"]
)

from typing import List

@router.post("/")
async def virtual_try_on(
    person_image: UploadFile = File(...), 
    clothing_images: List[UploadFile] = File(...),
    project_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Endpoint for virtual try-on.
    """
    try:
        # output_path is now blob name
        blob_name = await process_virtual_try_on(person_image, clothing_images)
        
        if project_id:
            asset = models.Asset(
                project_id=project_id,
                type="tryon",
                url=blob_name,
                prompt="Virtual Try-on"
            )
            db.add(asset)
            db.commit()
        
        signed_url = generate_signed_url(blob_name)

        return signed_url
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
