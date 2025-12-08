from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from backend.services.image_creation import generate_image, edit_image
from backend.database import get_db
from sqlalchemy.orm import Session
from backend import models
from fastapi import Depends

router = APIRouter(
    prefix="/image-creation",
    tags=["Image Creation"]
)

@router.post("/generate")
async def generate(
    prompt: str = Form(...),
    style: Optional[str] = Form(None),
    reference_images: List[UploadFile] = File(None),
    style_images: List[UploadFile] = File(None),
    product_images: List[UploadFile] = File(None),
    scene_images: List[UploadFile] = File(None),
    project_id: Optional[int] = Form(None),
    model_name: Optional[str] = Form("gemini-2.5-flash-image"),
    db: Session = Depends(get_db)
):
    try:
        # Call
        # image_url here is now the blob name from storage.upload_bytes
        blob_name = await generate_image(
            prompt, 
            style=style, 
            reference_images=reference_images,
            style_images=style_images,
            product_images=product_images,
            scene_images=scene_images,
            model_name=model_name
        )
        
        # Auto-save removed. User must explicitly save.
        # if project_id:
        #     asset = models.Asset(
        #         project_id=project_id,
        #         type="image",
        #         url=blob_name, # Store blob name
        #         prompt=prompt
        #     )
        #     db.add(asset)
        #     db.commit()
            
        # Generate signed URL for immediate display
        from backend.services.storage import generate_signed_url
        signed_url = generate_signed_url(blob_name)
            
        return {"image_url": signed_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/edit")
async def edit(
    image: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    instruction: str = Form(...),
    style: Optional[str] = Form(None),
    reference_images: List[UploadFile] = File(None),
    model_name: Optional[str] = Form("gemini-2.5-flash-image")
):
    try:
        if image:
            image_bytes = await image.read()
        elif image_url:
            # Download image from URL
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.get(image_url)
                resp.raise_for_status()
                image_bytes = resp.content
        else:
            raise HTTPException(status_code=400, detail="Either image file or image_url must be provided")

        # Returns base64 string
        image_b64 = await edit_image(image_bytes, instruction, style=style, reference_images=reference_images, model_name=model_name)
        return {"image_data": image_b64}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SaveRequest(BaseModel):
    image_data: Optional[str] = None # Base64
    image_url: Optional[str] = None # URL to download
    project_id: int
    prompt: Optional[str] = ""
    model_type: Optional[str] = None
    context_version: Optional[str] = None

@router.post("/save")
async def save(
    request: SaveRequest,
    db: Session = Depends(get_db)
):
    try:
        from backend.services.image_creation import save_image_asset
        
        image_b64 = request.image_data
        
        if request.image_url:
            # Download image from URL
            import httpx
            import base64
            async with httpx.AsyncClient() as client:
                resp = await client.get(request.image_url)
                resp.raise_for_status()
                # Convert to base64
                image_b64 = base64.b64encode(resp.content).decode('utf-8')
        
        if not image_b64:
             raise HTTPException(status_code=400, detail="Either image_data or image_url must be provided")

        blob_name = await save_image_asset(
            image_b64, 
            request.project_id, 
            request.prompt, 
            db,
            model_type=request.model_type,
            context_version=request.context_version
        )
        
        # Generate signed URL
        from backend.services.storage import generate_signed_url
        signed_url = generate_signed_url(blob_name)
        
        return {"image_url": signed_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class OptimizeRequest(BaseModel):
    prompt: str
    model_name: Optional[str] = "gemini-2.5-flash"

@router.post("/optimize")
async def optimize_prompt(
    request: OptimizeRequest
):
    try:
        from backend.services.image_creation import optimize_prompt_text
        optimized_text = await optimize_prompt_text(request.prompt, request.model_name)
        return {"optimized_prompt": optimized_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
