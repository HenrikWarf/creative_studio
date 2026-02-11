
import os
import time
from fastapi import UploadFile
from google import genai
from google.genai import types
from backend.prompts.prompt_optimizer import PROMPT_OPTIMIZER_PROMPT, PROMPT_OPTIMIZER_VIDEO_PROMPT
from backend.prompts.product_motion import PRODUCT_MOTION_PROMPTS

async def optimize_image_prompt(image: UploadFile, instructions: str) -> str:
    """
    Optimizes a video generation prompt based on an input image and user instructions using Gemini 1.5 Flash.
    """
    if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
        client = genai.Client(
            vertexai=True,
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location=os.getenv("GOOGLE_CLOUD_LOCATION")
        )
    else:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise Exception("GEMINI_API_KEY not found")
        client = genai.Client(api_key=api_key)

    image_bytes = await image.read()
    
    if instructions in PRODUCT_MOTION_PROMPTS:
        prompt = PRODUCT_MOTION_PROMPTS[instructions]
    else:
        prompt = PROMPT_OPTIMIZER_PROMPT.format(instructions=instructions)

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                prompt,
                types.Part.from_bytes(data=image_bytes, mime_type=image.content_type)
            ]
        )
        
        return response.text.strip()
    except Exception as e:
        print(f"Error optimizing image prompt: {e}")
        raise e

async def optimize_video_prompt(video: UploadFile, instructions: str) -> str:
    """
    Optimizes a prompt for video extension using Gemini 1.5 Pro (multimodal).
    """
    if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
        client = genai.Client(
            vertexai=True,
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location=os.getenv("GOOGLE_CLOUD_LOCATION")
        )
    else:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
             raise Exception("GEMINI_API_KEY not found")
        client = genai.Client(api_key=api_key)

    video_bytes = await video.read()
    
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_video:
        temp_video.write(video_bytes)
        temp_video_path = temp_video.name

    try:
        uploaded_file = client.files.upload(path=temp_video_path)
        
        while uploaded_file.state.name == "PROCESSING":
             print("Waiting for video to be processed for prompt optimization...")
             time.sleep(2)
             uploaded_file = client.files.get(name=uploaded_file.name)
             
        if uploaded_file.state.name == "FAILED":
             raise Exception("Video processing failed for optimization")

        prompt = PROMPT_OPTIMIZER_VIDEO_PROMPT.format(instructions=instructions)
        
        response = client.models.generate_content(
            model="gemini-1.5-pro-002",
            contents=[uploaded_file, prompt]
        )
        
        return response.text.strip()

    finally:
        if os.path.exists(temp_video_path):
            os.unlink(temp_video_path)
