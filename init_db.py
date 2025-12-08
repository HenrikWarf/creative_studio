from backend.database import engine
from backend import models

print("Creating tables...")
try:
    models.Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")
except Exception as e:
    print(f"Error creating tables: {e}")
