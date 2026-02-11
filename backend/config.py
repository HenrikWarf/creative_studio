import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Project
    GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
    GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
    GOOGLE_GENAI_USE_VERTEXAI = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "True") == "True"
    
    # Models - Text
    MODEL_TEXT_FAST = os.getenv("MODEL_TEXT_FAST", "gemini-2.5-flash")
    MODEL_TEXT_HIGH_QUALITY = os.getenv("MODEL_TEXT_HIGH_QUALITY", "gemini-2.5-pro")
    MODEL_INSIGHTS = os.getenv("MODEL_INSIGHTS", "gemini-2.5-pro")
    
    # Models - Image
    MODEL_IMAGE_FAST = os.getenv("MODEL_IMAGE_FAST", "gemini-2.5-flash-image")
    MODEL_IMAGE_HIGH_QUALITY = os.getenv("MODEL_IMAGE_HIGH_QUALITY", "publishers/google/models/gemini-3-pro-image-preview")
    
    # GCS
    GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "creative-studio-assets")

config = Config()
