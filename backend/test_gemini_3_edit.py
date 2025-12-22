import sys
import os
import asyncio
from unittest.mock import MagicMock

# Mock storage module
sys.modules["backend.services.storage"] = MagicMock()

from backend.services.image_creation import edit_image
from dotenv import load_dotenv

load_dotenv()
os.environ["GOOGLE_CLOUD_PROJECT"] = "ml-developer-project-fe07"
os.environ["GOOGLE_CLOUD_LOCATION"] = "us-central1"
os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "True"

async def test_edit():
    image_path = "/Users/henrikw/.gemini/antigravity/brain/de5f7c20-7280-4d02-af9a-f0dddaa56da3/uploaded_image_1765897180500.png"
    
    if not os.path.exists(image_path):
        print(f"Image not found at {image_path}")
        return

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    print("Sending edit request...")
    try:
        images_b64 = await edit_image(
            image_data=image_bytes,
            instruction="Make it black and white",
            model_name="gemini-3-pro-image-preview",
            num_images=1
        )
        
        print(f"Received {len(images_b64)} images")
        for i, b64 in enumerate(images_b64):
            print(f"Image {i} length: {len(b64)}")
            print(f"Image {i} start: {b64[:50]}")
            print(f"Image {i} end: {b64[-50:]}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_edit())
