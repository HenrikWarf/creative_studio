from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class AssetBase(BaseModel):
    type: str
    url: str
    prompt: Optional[str] = None
    model_type: Optional[str] = None
    context_version: Optional[str] = None
    context_data: Optional[str] = None

class AssetCreate(AssetBase):
    pass

class Asset(AssetBase):
    id: int
    project_id: int
    created_at: datetime

    class Config:
        from_attributes = True

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

class ProjectBrief(ProjectBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class Project(ProjectBase):
    id: int
    created_at: datetime
    assets: List[Asset] = []

    class Config:
        from_attributes = True
