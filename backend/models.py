from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text, nullable=True)
    context = Column(Text, nullable=True)
    
    # Context Engineering
    brand_vibe = Column(String, nullable=True)
    brand_lighting = Column(String, nullable=True)
    brand_colors = Column(String, nullable=True)
    brand_subject = Column(String, nullable=True)
    
    project_vibe = Column(String, nullable=True)
    project_lighting = Column(String, nullable=True)
    project_colors = Column(String, nullable=True)
    project_subject = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    assets = relationship("Asset", back_populates="project")

class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    type = Column(String) # image, video, tryon
    url = Column(String)
    prompt = Column(Text, nullable=True)
    model_type = Column(String, nullable=True)
    context_version = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="assets")

class ContextVersion(Base):
    __tablename__ = "context_versions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String)
    description = Column(String, nullable=True)
    
    # Context Data
    brand_vibe = Column(String, nullable=True)
    brand_lighting = Column(String, nullable=True)
    brand_colors = Column(String, nullable=True)
    brand_subject = Column(String, nullable=True)
    
    project_vibe = Column(String, nullable=True)
    project_lighting = Column(String, nullable=True)
    project_colors = Column(String, nullable=True)
    project_subject = Column(String, nullable=True)
    
    context = Column(Text, nullable=True) # Overall context
    
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="context_versions")

# Update Project relationship
Project.context_versions = relationship("ContextVersion", back_populates="project")
