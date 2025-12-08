from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class AssetBase(BaseModel):
    type: str
    url: str
    prompt: Optional[str] = None
    model_type: Optional[str] = None
    context_version: Optional[str] = None

class AssetCreate(AssetBase):
    pass

class Asset(AssetBase):
    id: int
    project_id: int
    created_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def validate_url(cls, v):
        from backend.services.storage import generate_signed_url
        # If it looks like a full URL (http/https), assume it's already processed or external
        if v.startswith("http"):
            return v
        return generate_signed_url(v)

    # Pydantic V2 style validator if using V2, but for V1 compat (FastAPI default often V1 or V2 compat):
    # We'll use a field_validator if V2, or validator if V1. 
    # Assuming Pydantic V2 is likely but let's check imports. 
    # The file imports `BaseModel`. 
    # Let's try the V1 `validator` first as it's often aliased in V2 or we can check.
    # Actually, let's just use a property or method on the response model? No, that's hard.
    # Let's use the `validator` decorator.
    
    from pydantic import validator
    
    @validator('url', pre=True)
    def sign_url(cls, v):
        from backend.services.storage import generate_signed_url
        if v and not v.startswith("http") and not v.startswith("Error"):
             return generate_signed_url(v)
        return v

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    context: Optional[str] = None
    
    brand_vibe: Optional[str] = None
    brand_lighting: Optional[str] = None
    brand_colors: Optional[str] = None
    brand_subject: Optional[str] = None
    
    project_vibe: Optional[str] = None
    project_lighting: Optional[str] = None
    project_colors: Optional[str] = None
    project_subject: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: int
    created_at: datetime
    assets: List[Asset] = []

    class Config:
        from_attributes = True
