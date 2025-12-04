from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas, database

router = APIRouter(
    prefix="/projects",
    tags=["projects"],
    responses={404: {"description": "Not found"}},
)

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=schemas.Project)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    db_project = models.Project(
        name=project.name, 
        description=project.description, 
        context=project.context,
        brand_vibe=project.brand_vibe,
        brand_lighting=project.brand_lighting,
        brand_colors=project.brand_colors,
        brand_subject=project.brand_subject,
        project_vibe=project.project_vibe,
        project_lighting=project.project_lighting,
        project_colors=project.project_colors,
        project_subject=project.project_subject
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.get("/", response_model=List[schemas.Project])
def read_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    projects = db.query(models.Project).offset(skip).limit(limit).all()
    return projects

@router.get("/{project_id}", response_model=schemas.Project)
def read_project(project_id: int, db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    project = db.query(models.Project).options(joinedload(models.Project.assets)).filter(models.Project.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Delete associated assets first (optional if cascade delete is set up, but safe to do explicit)
    db.query(models.Asset).filter(models.Asset.project_id == project_id).delete()
    
    db.delete(project)
    db.commit()
    return {"status": "success"}

@router.put("/{project_id}", response_model=schemas.Project)
def update_project(project_id: int, project_update: schemas.ProjectCreate, db: Session = Depends(get_db)):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db_project.name = project_update.name
    db_project.description = project_update.description
    db_project.context = project_update.context
    
    db_project.brand_vibe = project_update.brand_vibe
    db_project.brand_lighting = project_update.brand_lighting
    db_project.brand_colors = project_update.brand_colors
    db_project.brand_subject = project_update.brand_subject
    
    db_project.project_vibe = project_update.project_vibe
    db_project.project_lighting = project_update.project_lighting
    db_project.project_colors = project_update.project_colors
    db_project.project_subject = project_update.project_subject
    
    db.commit()
    db.refresh(db_project)
    return db_project
