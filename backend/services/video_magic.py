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

async def generate_image_to_video(image: UploadFile, prompt: str, context: str = None) -> dict:
    """
    Generates a video from an image using Veo 3.1.
    Returns a dict with 'video_url' and 'blob_name'.
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

    # 1. Upload Input Image to GCS
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

    print(f"DEBUG: Generating video with prompt: {full_prompt}")

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

        operation = client.models.generate_videos(
            model="veo-3.1-generate-preview",
            prompt=full_prompt,
            image=types.Image(
                image_bytes=image_bytes,
                mime_type=image.content_type
            ),
            config=types.GenerateVideosConfig(**config_params),
        )

        print("DEBUG: Video generation started. Waiting for completion...")
        
        # 4. Poll for completion
        while not operation.done:
            time.sleep(10)
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
            # We need to find this file and move it to output_filename
            
            actual_blob = None
            max_retries = 10
            
            print(f"DEBUG: Looking for video files with prefix: {output_filename}")
            
            for i in range(max_retries):
                # List blobs with the prefix
                blobs = list(bucket.list_blobs(prefix=output_filename))
                
                for b in blobs:
                    if b.name.endswith(".mp4") and b.name != output_filename:
                        actual_blob = b
                        break
                
                if actual_blob:
                    print(f"DEBUG: Found generated video at: {actual_blob.name}")
                    break
                
                print(f"DEBUG: Video file not found yet, retrying ({i+1}/{max_retries})...")
                time.sleep(2)
            
            if actual_blob:
                # Copy to the intended location
                target_blob = bucket.blob(output_filename)
                bucket.copy_blob(actual_blob, bucket, output_filename)
                print(f"DEBUG: Moved video to {output_filename}")
                
                # Set content type
                target_blob.content_type = "video/mp4"
                target_blob.patch()
                
                # Clean up the original file (optional, but good for hygiene)
                try:
                    actual_blob.delete()
                    print("DEBUG: Cleaned up original Vertex AI output file")
                except Exception as e:
                    print(f"WARNING: Failed to delete original file: {e}")
            else:
                print("WARNING: Could not find generated video file after retries.")
                # Fallback: check if the file exists at output_filename directly (in case behavior changes)
                blob = bucket.blob(output_filename)
                if blob.exists():
                    blob.content_type = "video/mp4"
                    blob.patch()
                else:
                    raise Exception("Failed to locate generated video in GCS")

            # Just generate signed URL.
            from backend.services.storage import generate_signed_url
            video_url = generate_signed_url(output_filename)
            print(f"DEBUG: Generated signed URL: {video_url}")
            
            return {
                "video_url": video_url,
                "blob_name": output_filename
            }

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
        print(f"Error generating image-to-video: {e}")
        raise e

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
    full_prompt = f"""
    You are an expert video scriptwriter. Your task is to create a compelling video script based on the user's request.
    
    User Prompt: {prompt}
    
    """
    
    if context:
        full_prompt += f"""
        Context / Brand Guidelines:
        {context}
        
        Please ensure the script aligns with these guidelines.
        """
        
    full_prompt += """
    Output Format:
    Return ONLY a JSON array of objects. Each object represents a scene and must have exactly two keys:
    - "visual": A detailed description of what is seen on screen.
    - "audio": The dialogue, voiceover, sound effects, or music instructions.
    
    Example:
    [
        {"visual": "Close up of a coffee cup with steam rising.", "audio": "SFX: Gentle morning birds. VO: Start your day right."},
        {"visual": "Woman takes a sip and smiles.", "audio": "VO: With our new organic blend."}
    ]
    """

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
    
    full_prompt = f"""
    You are an expert video script editor.
    
    Current Script (JSON):
    {json.dumps(current_script, indent=2)}
    
    User Instructions for Edit:
    {instructions}
    
    Please modify the script according to the instructions. Maintain the same JSON structure (array of objects with "visual" and "audio").
    Return ONLY the JSON array.
    """
    
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
    
    prompt = f"""
    You are an expert video prompt engineer. 
    Analyze the provided image and the user's instructions: "{instructions}".
    
    Create a detailed, descriptive prompt for a video generation model (like Veo) that:
    1. Accurately describes the visual elements of the image (subject, setting, lighting, style).
    2. Incorporates the user's requested motion or transformation.
    3. Uses professional filmmaking terminology (e.g., "slow pan", "rack focus", "cinematic lighting").
    
    Output ONLY the optimized prompt text. Do not include any explanations or markdown formatting.
    """

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
