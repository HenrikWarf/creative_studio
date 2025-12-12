import os
import time
import uuid
from google import genai
from google.genai.types import GenerateVideosConfig
from backend.services.storage import BUCKET_NAME
from typing import List
import asyncio

from google.genai.types import GenerateVideosConfig
from backend.services.storage import BUCKET_NAME

async def generate_video(prompt: str, aspect_ratio: str = "16:9", quality: str = "speed", num_videos: int = 1) -> List[dict]:
    """
    Generates videos using Veo model concurrently.
    Returns a list of dicts with 'video_url' and 'blob_name'.
    """
    if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
        client = genai.Client(
            vertexai=True,
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location=os.getenv("GOOGLE_CLOUD_LOCATION")
        )
        print("DEBUG: Using Vertex AI for video generation")
    else:
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        print("DEBUG: Using Gemini API for video generation")
    
    # Select model based on quality preference
    if quality == "quality":
        model_name = "veo-3.1-generate-preview"
    else:
        model_name = "veo-3.1-fast-generate-preview" # Default to speed/fast
    
    print(f"DEBUG: Using model: {model_name} for quality: {quality}")

    async def _generate_single_video():
        try:
            # Generate a unique filename for the output
            filename = f"generated_videos/{uuid.uuid4()}.mp4"
            output_gcs_uri = f"gs://{BUCKET_NAME}/{filename}"
            
            print(f"DEBUG: Generating video with prompt: {prompt}, aspect_ratio: {aspect_ratio}")

            config_params = {
                "aspect_ratio": aspect_ratio,
            }
            
            # If using Vertex AI, specify output_gcs_uri
            if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
                config_params["output_gcs_uri"] = output_gcs_uri
                print(f"DEBUG: Using output_gcs_uri: {output_gcs_uri}")

            operation = client.models.generate_videos(
                model=model_name,
                prompt=prompt,
                config=GenerateVideosConfig(**config_params),
            )

            print("DEBUG: Video generation started. Waiting for completion...")
            
            # Poll for completion
            while not operation.done:
                await asyncio.sleep(10)
                operation = client.operations.get(operation)
                print("DEBUG: Waiting for video generation...")

            if operation.error:
                 raise Exception(f"Video generation failed: {operation.error}")

            # If Vertex AI with output_gcs_uri, we know where it is
            if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
                print(f"DEBUG: Video generated at {output_gcs_uri}")
                
                from backend.services.storage import storage_client
                bucket = storage_client.bucket(BUCKET_NAME)
                
                # Vertex AI appends a timestamp and filename to the output_gcs_uri
                # e.g. .../uuid.mp4/123456/sample_0.mp4
                # We need to find this file and move it to filename
                
                actual_blob = None
                max_retries = 10
                
                print(f"DEBUG: Looking for video files with prefix: {filename}")
                
                for i in range(max_retries):
                    # List blobs with the prefix
                    blobs = list(bucket.list_blobs(prefix=filename))
                    
                    for b in blobs:
                        if b.name.endswith(".mp4") and b.name != filename:
                            actual_blob = b
                            break
                    
                    if actual_blob:
                        print(f"DEBUG: Found generated video at: {actual_blob.name}")
                        break
                    
                    print(f"DEBUG: Video file not found yet, retrying ({i+1}/{max_retries})...")
                    await asyncio.sleep(2)
                
                if actual_blob:
                    # Copy to the intended location
                    target_blob = bucket.blob(filename)
                    bucket.copy_blob(actual_blob, bucket, filename)
                    print(f"DEBUG: Moved video to {filename}")
                    
                    # Set content type
                    target_blob.content_type = "video/mp4"
                    target_blob.patch()
                    
                    # Clean up the original file (optional)
                    try:
                        actual_blob.delete()
                        print("DEBUG: Cleaned up original Vertex AI output file")
                    except Exception as e:
                        print(f"WARNING: Failed to delete original file: {e}")
                else:
                    print("WARNING: Could not find generated video file after retries.")
                    # Fallback: check if the file exists at filename directly
                    blob = bucket.blob(filename)
                    if blob.exists():
                        blob.content_type = "video/mp4"
                        blob.patch()
                    else:
                        raise Exception("Failed to locate generated video in GCS")
                
                from backend.services.storage import generate_signed_url
                video_url = generate_signed_url(filename)
                return {"video_url": video_url, "blob_name": filename}

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
                
                from backend.services.storage import generate_signed_url
                video_url = generate_signed_url(filename)
                return {"video_url": video_url, "blob_name": filename}
            else:
                raise Exception("No video generated in response")

        except Exception as e:
            print(f"Error generating video: {e}")
            raise e

    # Run concurrently
    tasks = [_generate_single_video() for _ in range(num_videos)]
    results = await asyncio.gather(*tasks)
    
    return results
