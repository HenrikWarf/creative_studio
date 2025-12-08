import os
import time
import uuid
from google import genai
from google.genai.types import GenerateVideosConfig
from backend.services.storage import BUCKET_NAME

client = genai.Client()

async def generate_video(prompt: str, aspect_ratio: str = "16:9", quality: str = "speed") -> str:
    """
    Generates a video using Veo model.
    Returns the blob name of the generated video.
    """
    # Select model based on quality preference
    # Select model based on quality preference
    if quality == "quality":
        model_name = "veo-3.1-generate-preview"
    else:
        model_name = "veo-3.1-fast-generate-preview" # Default to speed/fast
    
    print(f"DEBUG: Using model: {model_name} for quality: {quality}")
    try:
        # Generate a unique filename for the output
        filename = f"generated_videos/{uuid.uuid4()}.mp4"
        output_gcs_uri = f"gs://{BUCKET_NAME}/{filename}"
        
        print(f"DEBUG: Generating video with prompt: {prompt}, aspect_ratio: {aspect_ratio}")

        operation = client.models.generate_videos(
            model=model_name,
            prompt=prompt,
            config=GenerateVideosConfig(
                aspect_ratio=aspect_ratio,
            ),
        )

        print("DEBUG: Video generation started. Waiting for completion...")
        
        # Poll for completion
        while not operation.done:
            time.sleep(10)
            operation = client.operations.get(operation)
            print("DEBUG: Waiting for video generation...")

        if operation.error:
             raise Exception(f"Video generation failed: {operation.error}")

        if operation.result and operation.result.generated_videos:
            uri = operation.result.generated_videos[0].video.uri
            print(f"DEBUG: Video generation completed. URI: {uri}")
            
            # Download the video
            import urllib.request
            from backend.services.storage import upload_bytes
            
            print("DEBUG: Downloading video...")
            
            # Add API key to headers
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise Exception("GEMINI_API_KEY not found in environment variables")
                
            req = urllib.request.Request(uri)
            req.add_header('x-goog-api-key', api_key)
            
            with urllib.request.urlopen(req) as response:
                video_data = response.read()
                
            print(f"DEBUG: Uploading to GCS: {filename}")
            upload_bytes(video_data, filename, content_type="video/mp4")
            
            return filename
        else:
            raise Exception("No video generated in response")

    except Exception as e:
        print(f"Error generating video: {e}")
        raise e
