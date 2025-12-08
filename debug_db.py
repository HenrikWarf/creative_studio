from backend.database import SessionLocal
from backend import models

db = SessionLocal()
try:
    versions = db.query(models.ContextVersion).all()
    print(f"Found {len(versions)} context versions:")
    for v in versions:
        print(f"ID: {v.id}, Project ID: {v.project_id}, Name: {v.version_name}, Created: {v.created_at}")
except Exception as e:
    print(f"Error querying database: {e}")
finally:
    db.close()
