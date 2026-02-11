from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from backend.database import get_db
from backend import models
from google import genai
from google.genai import types
import os
import json
from datetime import datetime

from backend.services.image_creation import get_client
from backend.config import config

router = APIRouter(
    prefix="/context",
    tags=["context"]
)

class GenerateRequest(BaseModel):
    goal: str

class AnalyzeRequest(BaseModel):
    brand_name: str

class ContextVersionBase(BaseModel):
    name: str
    description: Optional[str] = None
    brand_vibe: Optional[str] = None
    brand_lighting: Optional[str] = None
    brand_colors: Optional[str] = None
    brand_subject: Optional[str] = None
    project_vibe: Optional[str] = None
    project_lighting: Optional[str] = None
    project_colors: Optional[str] = None
    project_subject: Optional[str] = None
    context: Optional[str] = None

class ContextVersionCreate(ContextVersionBase):
    project_id: int

class ContextVersionResponse(ContextVersionBase):
    id: int
    project_id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

@router.post("/generate")
async def generate_context(request: GenerateRequest):
    prompt = f"""
    Act as an expert Creative Director. Based on the following project goal, generate detailed context metadata.
    
    Goal: {request.goal}
    
    Return ONLY a JSON object with the following keys:
    - brand_vibe
    - brand_lighting
    - brand_colors
    - brand_subject
    - project_vibe
    - project_lighting
    - project_colors
    - project_subject
    - context (Overall context/guidelines)
    """
    
    try:
        client = get_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class EnhanceFieldRequest(BaseModel):
    current_value: str
    field_name: str
    instructions: Optional[str] = None

@router.post("/enhance-field")
async def enhance_field(request: EnhanceFieldRequest):
    prompt = f"""
    Act as an expert Creative Director and Copywriter.
    Your task is to enhance the text for a specific context field in a creative brief.

    Field Name: {request.field_name}
    Current Text: "{request.current_value}"
    
    User Instructions: {request.instructions if request.instructions else "Improve clarity, creativity, and impact."}

    Please rewrite the text to be more effective, professional, and aligned with the field's purpose.
    Keep it concise but descriptive.
    
    Return ONLY a JSON object with the following key:
    - enhanced_text
    """
    
    try:
        client = get_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-brand")
async def analyze_brand(request: AnalyzeRequest):
    prompt = f"""
    Analyze the brand '{request.brand_name}'. Search for information about their visual style, brand guidelines, recent campaigns, and core aesthetic.
    
    Based on your analysis, generate detailed context metadata for a creative project.
    
    Return ONLY a JSON object with the following keys:
    - brand_vibe
    - brand_lighting
    - brand_colors
    - brand_subject
    - context (Summary of the brand analysis and guidelines)
    """
    
    try:
        client = get_client()
        # Configure Google Search Grounding
        grounding_tool = types.Tool(
            google_search=types.GoogleSearch()
        )
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[grounding_tool]
            )
        )
        
        # Extract grounding metadata if available (for display in UI)
        grounding_metadata = None
        if response.candidates and response.candidates[0].grounding_metadata:
             # Convert to dict or simplified structure if needed, or just pass relevant parts
             # For now, we'll just return the generated JSON content
             pass

        # Parse JSON manually since response_mime_type is not supported with tools
        text = response.text
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        
        return json.loads(text.strip())
    except Exception as e:
        print(f"Error in analyze_brand: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/versions", response_model=ContextVersionResponse)
def create_version(version: ContextVersionCreate, db: Session = Depends(get_db)):
    db_version = models.ContextVersion(**version.dict())
    db.add(db_version)
    db.commit()
    db.refresh(db_version)
    return db_version

class ContextVersionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    brand_vibe: Optional[str] = None
    brand_lighting: Optional[str] = None
    brand_colors: Optional[str] = None
    brand_subject: Optional[str] = None
    project_vibe: Optional[str] = None
    project_lighting: Optional[str] = None
    project_colors: Optional[str] = None
    project_subject: Optional[str] = None
    context: Optional[str] = None

@router.get("/versions/{project_id}", response_model=List[ContextVersionResponse])
def get_versions(project_id: int, db: Session = Depends(get_db)):
    return db.query(models.ContextVersion).filter(models.ContextVersion.project_id == project_id).order_by(models.ContextVersion.created_at.desc()).all()

@router.get("/version/{version_id}", response_model=ContextVersionResponse)
def get_version_details(version_id: int, db: Session = Depends(get_db)):
    version = db.query(models.ContextVersion).filter(models.ContextVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version

@router.put("/versions/{version_id}", response_model=ContextVersionResponse)
def update_version(version_id: int, version_update: ContextVersionUpdate, db: Session = Depends(get_db)):
    db_version = db.query(models.ContextVersion).filter(models.ContextVersion.id == version_id).first()
    if not db_version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    update_data = version_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_version, key, value)
    
    db.commit()
    db.refresh(db_version)
    return db_version

@router.delete("/versions/{version_id}")
def delete_version(version_id: int, db: Session = Depends(get_db)):
    version = db.query(models.ContextVersion).filter(models.ContextVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    db.delete(version)
    db.commit()
    return {"message": "Version deleted successfully"}

@router.post("/analyze-file")
async def analyze_file(
    file: UploadFile = File(...),
    analysis_type: str = Form(...)
):
    try:
        content = await file.read()
        
        # Determine prompt based on analysis type
        if analysis_type == "brand":
            prompt = """
            Analyze this file to extract Brand Core details.
            Focus on visual style, brand guidelines, and core aesthetic.
            
            Return ONLY a JSON object with the following keys:
            - brand_vibe
            - brand_lighting
            - brand_colors
            - brand_subject
            """
        else:
            prompt = """
            Analyze this file to extract Project Specifics.
            Focus on the specific campaign or project details, mood, and requirements.
            
            Return ONLY a JSON object with the following keys:
            - project_vibe
            - project_lighting
            - project_colors
            - project_subject
            - context (Overall context/guidelines)
            """

        # Determine mime type
        mime_type = file.content_type or "application/octet-stream"
        
        client = get_client()
        response = client.models.generate_content(
            model=config.MODEL_TEXT_FAST,
            contents=[
                types.Part.from_bytes(data=content, mime_type=mime_type),
                prompt
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        
        return json.loads(response.text)
        
    except Exception as e:
        print(f"Error in analyze_file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class SynthesizeRequest(BaseModel):
    brand_vibe: Optional[str] = ""
    brand_lighting: Optional[str] = ""
    brand_colors: Optional[str] = ""
    brand_subject: Optional[str] = ""
    project_vibe: Optional[str] = ""
    project_lighting: Optional[str] = ""
    project_colors: Optional[str] = ""
    project_subject: Optional[str] = ""

@router.post("/synthesize")
async def synthesize_context(request: SynthesizeRequest):
    prompt = f"""
    Act as an expert Creative Director.
    Synthesize the following Brand Core and Project Specifics into a cohesive "Overall Context / Guidelines" paragraph.
    This paragraph will be used to guide an AI image generator, so it should be descriptive, evocative, and clear.

    Brand Core:
    - Vibe: {request.brand_vibe}
    - Lighting: {request.brand_lighting}
    - Colors: {request.brand_colors}
    - Subject: {request.brand_subject}

    Project Specifics:
    - Vibe: {request.project_vibe}
    - Lighting: {request.project_lighting}
    - Colors: {request.project_colors}
    - Subject: {request.project_subject}

    Return ONLY a JSON object with the following key:
    - synthesized_text
    """
    
    try:
        client = get_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class PromptInsightRequest(BaseModel):
    prompt_text: str

@router.post("/insight")
async def get_prompt_insight(request: PromptInsightRequest):
    prompt = f"""
    Act as an expert Creative Director and AI Image Generation Specialist. Analyze the following prompt and provide insights.
    
    Prompt to Analyze:
    {request.prompt_text}
    
    Provide a structured analysis in JSON format with the following keys:
    - creative_summary: A brief description of the type of content this prompt will produce (e.g., "High-fashion editorial with moody lighting").
    - key_features: A list of 3-5 bullet points highlighting the most impactful elements of the prompt.
    - style_explanation: An explanation of why the prompt will result in the specific visual style (referencing lighting, colors, vibe).
    - suggestions: A list of objects, each with "suggestion" (the proposed change) and "impact" (what this change would achieve). Suggest 2-3 meaningful improvements or variations.
    
    Return ONLY the JSON object.
    """
    
    try:
        client = get_client()
        response = client.models.generate_content(
            model=config.MODEL_INSIGHTS,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
