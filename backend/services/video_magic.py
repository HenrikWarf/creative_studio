import os
import json
import time
import uuid
import urllib.request
from google import genai
from google.genai import types
from typing import List, Dict
from fastapi import UploadFile
from backend.services.storage import BUCKET_NAME, upload_bytes
import asyncio
from backend.prompts.video_script_writer import VIDEO_SCRIPT_WRITER_PROMPT
from backend.prompts.video_script_editor import VIDEO_SCRIPT_EDITOR_PROMPT
from backend.prompts.prompt_optimizer import PROMPT_OPTIMIZER_PROMPT
from backend.prompts.product_motion import PRODUCT_MOTION_PROMPTS

async def generate_image_to_video(image: UploadFile, prompt: str, context: str = None, num_videos: int = 1) -> List[dict]:
    """
    Generates videos from an image using Veo 3.1 concurrently.
    Returns a list of dicts with 'video_url' and 'blob_name'.
    """
    if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
        client = genai.Client(
            vertexai=True,
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location=os.getenv("GOOGLE_CLOUD_LOCATION")
        )
        print("DEBUG: Using Vertex AI for image-to-video generation")
    else:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise Exception("GEMINI_API_KEY not found")
        client = genai.Client(api_key=api_key)
        print("DEBUG: Using Gemini API for image-to-video generation")

    # 1. Upload Input Image to GCS (Once for all videos)
    image_bytes = await image.read()
    input_filename = f"temp_inputs/{uuid.uuid4()}.png" # Assuming png or generic image
    # We need to upload to GCS to get a gs:// URI for Veo
    # Using the existing upload_bytes function which uploads to the default bucket
    # Note: upload_bytes returns the blob name, not gs:// URI directly usually, but let's check.
    # It returns destination_blob_name.
    
    # We need to manually construct gs:// URI
    # Or use a helper if available.
    
    # Uploading...
    upload_bytes(image_bytes, input_filename, content_type=image.content_type)
    input_gcs_uri = f"gs://{BUCKET_NAME}/{input_filename}"
    
    print(f"DEBUG: Input image uploaded to {input_gcs_uri}")

    # 2. Construct Prompt
    full_prompt = prompt
    if context:
        full_prompt += f"\n\nContext / Brand Guidelines:\n{context}\n\nPlease ensure the video aligns with these guidelines."

    print(f"DEBUG: Generating {num_videos} videos with prompt: {full_prompt}")

    async def _generate_single_video():
        # 3. Call Veo Model
        try:
            # Generate unique filename for output
            output_filename = f"generated_videos/{uuid.uuid4()}.mp4"
            output_gcs_uri = f"gs://{BUCKET_NAME}/{output_filename}"
            
            config_params = {
                "aspect_ratio": "16:9", # Default
            }
            
            # If using Vertex AI, specify output_gcs_uri
            if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
                config_params["output_gcs_uri"] = output_gcs_uri
                print(f"DEBUG: Using output_gcs_uri: {output_gcs_uri}")

            # Get the running loop
            loop = asyncio.get_running_loop()

            # Wrap the blocking call in run_in_executor
            def call_generate_videos():
                return client.models.generate_videos(
                    model="veo-3.1-generate-preview",
                    prompt=full_prompt,
                    image=types.Image(
                        gcs_uri=input_gcs_uri,
                        mime_type=image.content_type
                    ) if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True" else types.Image(
                        image_bytes=image_bytes,
                        mime_type=image.content_type
                    ),
                    config=types.GenerateVideosConfig(**config_params),
                )

            operation = await loop.run_in_executor(None, call_generate_videos)

            print("DEBUG: Video generation started. Waiting for completion...")
            
            # 4. Poll for completion
            while not operation.done:
                await asyncio.sleep(10) # Async sleep
                # Wrap polling in run_in_executor
                operation = await loop.run_in_executor(None, lambda: client.operations.get(operation))
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
                # We need to find this file and move it to output_filename
                
                # List blobs with prefix
                prefix = output_filename # This is the folder name essentially if Vertex creates subfolders
                # Wait, Vertex AI output_gcs_uri is a folder or file?
                # Documentation says: "The Cloud Storage URI where the generated video will be saved."
                # If it ends in /, it's a folder. If not, it might be a prefix.
                # Let's assume it creates a folder structure.
                
                # Actually, Veo on Vertex AI usually outputs to the specified URI but might append things.
                # Let's try to find the blob.
                
                # Retry logic for eventual consistency
                found_blob = None
                for _ in range(10):
                    blobs = list(bucket.list_blobs(prefix=output_filename))
                    if blobs:
                        # Find the largest mp4 file (assuming it's the video)
                        video_blobs = [b for b in blobs if b.name.endswith('.mp4')]
                        if video_blobs:
                            found_blob = video_blobs[0] # Take the first one
                            break
                    await asyncio.sleep(2)
                
                if not found_blob:
                     # Fallback: maybe it wrote exactly to output_filename?
                     blob = bucket.blob(output_filename)
                     if blob.exists():
                         found_blob = blob
                     else:
                         # Try searching broadly in the directory if output_filename was treated as a directory
                         pass

                if found_blob:
                    # Move to the expected location if it's not there
                    if found_blob.name != output_filename:
                        bucket.rename_blob(found_blob, output_filename)
                    
                    # Set content type
                    final_blob = bucket.blob(output_filename)
                    final_blob.content_type = "video/mp4"
                    final_blob.patch()
                    
                    from backend.services.storage import generate_signed_url
                    video_url = generate_signed_url(output_filename)
                    return {"video_url": video_url, "blob_name": output_filename}
                else:
                    raise Exception("Could not locate generated video in GCS")

            else:
                # Gemini API (non-Vertex)
                if operation.result and operation.result.generated_videos:
                    video = operation.result.generated_videos[0].video
                    uri = video.uri
                    
                    print(f"DEBUG: Video generation completed. URI: {uri}")
                    
                    if not uri:
                         raise Exception("Generated video has no URI")
        
                    # Handle HTTP URI (AI Studio)
                    print("DEBUG: Downloading generated video from HTTP URI...")
                    req = urllib.request.Request(uri)
                    if "googleapis.com" in uri:
                        req.add_header('x-goog-api-key', api_key)
                    
                    with urllib.request.urlopen(req) as response:
                        video_data = response.read()
                        
                    print(f"DEBUG: Uploading to GCS: {output_filename}")
                    upload_bytes(video_data, output_filename, content_type="video/mp4")
                    
                    # Generate signed URL for frontend
                    from backend.services.storage import generate_signed_url
                    video_url = generate_signed_url(output_filename)
                    
                    return {
                        "video_url": video_url,
                        "blob_name": output_filename
                    }
                else:
                    raise Exception("No video generated in response")
                
        except Exception as e:
            print(f"Error generating video: {e}")
            raise e

    # Run concurrently
    tasks = [_generate_single_video() for _ in range(num_videos)]
    results = await asyncio.gather(*tasks)
    
    return results

async def generate_script(prompt: str, context: str = None) -> List[Dict[str, str]]:
    """
    Generates a video script using Gemini 2.5 Flash.
    Returns a list of scenes, each with 'visual' and 'audio' keys.
    """
    if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
        client = genai.Client(
            vertexai=True,
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location=os.getenv("GOOGLE_CLOUD_LOCATION")
        )
        print("DEBUG: Using Vertex AI for script generation")
    else:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise Exception("GEMINI_API_KEY not found")
        client = genai.Client(api_key=api_key)
        print("DEBUG: Using Gemini API for script generation")
    
    # Construct the prompt
    # Construct the prompt
    full_prompt = VIDEO_SCRIPT_WRITER_PROMPT.format(
        prompt=prompt,
        context_section=f"Context / Brand Guidelines:\n{context}\n\nPlease ensure the script aligns with these guidelines." if context else ""
    )
    
    # Removed hardcoded prompt and example as they are now in the imported constant


    try:
        # Using Gemini 2.5 Flash Experimental as requested
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=full_prompt,
            config=types.GenerateContentConfig(
                response_mime_type='application/json'
            )
        )
        
        script_json = json.loads(response.text)
        return script_json

    except Exception as e:
        print(f"Error generating script: {e}")
        # Fallback to 1.5 Flash if 2.0 fails (e.g. if not available in current region/key)
        try:
            print("Falling back to gemini-2.5-flash...")
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type='application/json'
                )
            )
            script_json = json.loads(response.text)
            return script_json
        except Exception as e2:
             raise Exception(f"Failed to generate script: {e2}")

async def edit_script(current_script: List[Dict[str, str]], instructions: str) -> List[Dict[str, str]]:
    """
    Edits an existing script based on user instructions.
    """
    if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
        client = genai.Client(
            vertexai=True,
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location=os.getenv("GOOGLE_CLOUD_LOCATION")
        )
        print("DEBUG: Using Vertex AI for script editing")
    else:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise Exception("GEMINI_API_KEY not found")
        client = genai.Client(api_key=api_key)
        print("DEBUG: Using Gemini API for script editing")
    
    full_prompt = VIDEO_SCRIPT_EDITOR_PROMPT.format(
        current_script_json=json.dumps(current_script, indent=2),
        instructions=instructions
    )
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=full_prompt,
            config=types.GenerateContentConfig(
                response_mime_type='application/json'
            )
        )
        
        script_json = json.loads(response.text)
        return script_json
    except Exception as e:
         # Fallback
        try:
            response = client.models.generate_content(
                model='gemini-1.5-flash',
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type='application/json'
                )
            )
            script_json = json.loads(response.text)
            return script_json
        except Exception as e2:
             raise Exception(f"Failed to edit script: {e2}")

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

    # Read image bytes
    image_bytes = await image.read()
    
    # Check if instructions correspond to a known product motion prompt key
    if instructions in PRODUCT_MOTION_PROMPTS:
        # It's a key! Use the specific persona prompt
        prompt = PRODUCT_MOTION_PROMPTS[instructions]
    else:
        # It's raw text instructions! Use the generic optimizer prompt
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
