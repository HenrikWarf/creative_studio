import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Creative Studio")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from backend.routers import virtual_tryon, image_creation, video_creation, projects
from backend import models
from backend.database import engine

models.Base.metadata.create_all(bind=engine)

app.include_router(virtual_tryon.router)
app.include_router(image_creation.router)
app.include_router(video_creation.router)
app.include_router(projects.router)
from backend.routers import assets
app.include_router(assets.router)

# Serve frontend static files
# Mount the frontend directory to serve static files
# We use absolute path relative to this file to ensure it works regardless of CWD
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="static")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
