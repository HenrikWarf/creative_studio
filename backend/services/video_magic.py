import os
import json
import time
import uuid
import urllib.request
from google import genai
from google.genai import types
from typing import List, Dict, Optional
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

async def generate_video_first_last(first_image: UploadFile, last_image: UploadFile, prompt: str, context: str = None, num_videos: int = 1) -> Dict[str, List[Dict[str, str]]]:
    """
    Generates videos transitioning between two images using Veo 3.1.
    Returns a dict with 'videos' list containing 'video_url' and 'blob_name'.
    """
    if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
        client = genai.Client(
            vertexai=True,
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location=os.getenv("GOOGLE_CLOUD_LOCATION")
        )
        print("DEBUG: Using Vertex AI for first-last frame video generation")
    else:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise Exception("GEMINI_API_KEY not found")
        client = genai.Client(api_key=api_key)
        print("DEBUG: Using Gemini API for first-last frame video generation")

    # 1. Upload Input Images to GCS (Once)
    first_image_bytes = await first_image.read()
    last_image_bytes = await last_image.read()
    
    first_filename = f"temp_inputs/{uuid.uuid4()}_first.png"
    last_filename = f"temp_inputs/{uuid.uuid4()}_last.png"
    
    upload_bytes(first_image_bytes, first_filename, content_type=first_image.content_type)
    upload_bytes(last_image_bytes, last_filename, content_type=last_image.content_type)
    
    first_gcs_uri = f"gs://{BUCKET_NAME}/{first_filename}"
    last_gcs_uri = f"gs://{BUCKET_NAME}/{last_filename}"
    
    print(f"DEBUG: Input images uploaded to {first_gcs_uri} and {last_gcs_uri}")

    # 2. Construct Prompt
    full_prompt = prompt
    if context:
        full_prompt += f"\n\nContext / Brand Guidelines:\n{context}\n\nPlease ensure the video aligns with these guidelines."

    print(f"DEBUG: Generating {num_videos} videos with prompt: {full_prompt}")

    async def _generate_single_video():
        # 3. Call Veo Model
        try:
            output_filename = f"generated_videos/{uuid.uuid4()}.mp4"
            output_gcs_uri = f"gs://{BUCKET_NAME}/{output_filename}"
            
            config_params = {
                "aspect_ratio": "16:9",
            }
            
            # Vertex AI specific config
            if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
                config_params["output_gcs_uri"] = output_gcs_uri
                # Vertex needs GCS URI for last_frame
                config_params["last_frame"] = types.Image(
                    gcs_uri=last_gcs_uri,
                    mime_type=last_image.content_type
                )
            else:
                 config_params["last_frame"] = types.Image(
                    image_bytes=last_image_bytes,
                    mime_type=last_image.content_type
                 )

            # Get the running loop
            loop = asyncio.get_running_loop()

            def call_generate_videos():
                return client.models.generate_videos(
                    model="veo-3.1-generate-preview",
                    prompt=full_prompt,
                    image=types.Image(
                        gcs_uri=first_gcs_uri,
                        mime_type=first_image.content_type
                    ) if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True" else types.Image(
                        image_bytes=first_image_bytes,
                        mime_type=first_image.content_type
                    ),
                    config=types.GenerateVideosConfig(**config_params),
                )

            operation = await loop.run_in_executor(None, call_generate_videos)

            print("DEBUG: Video generation started. Waiting for completion...")
            
            # 4. Poll for completion
            while not operation.done:
                await asyncio.sleep(10)
                operation = await loop.run_in_executor(None, lambda: client.operations.get(operation))
                print("DEBUG: Waiting for first-last frame video generation...")

            if operation.error:
                raise Exception(f"Video generation failed: {operation.error}")

            if operation.result and operation.result.generated_videos:
                video = operation.result.generated_videos[0].video
                uri = video.uri
                
                print(f"DEBUG: Video generation completed. URI: {uri}")
                
                if not uri:
                        raise Exception("Generated video has no URI")
    
                # Handle GCS URI (gs://) or HTTP URI
                if uri.startswith("gs://"):
                    print("DEBUG: Handling gs:// URI directly")
                    # Parse bucket and blob name from uri: gs://bucket/blob_name
                    # format: gs://{BUCKET_NAME}/{blob_name}
                    
                    # Remove gs://
                    path_parts = uri[5:].split("/", 1)
                    if len(path_parts) != 2:
                         raise Exception(f"Invalid GCS URI: {uri}")
                    
                    source_bucket_name = path_parts[0]
                    source_blob_name = path_parts[1]
                    
                    from backend.services.storage import storage_client
                    source_bucket = storage_client.bucket(source_bucket_name)
                    source_blob = source_bucket.blob(source_blob_name)
                    
                    if not source_blob.exists():
                         # Try waiting a bit if eventual consistency
                         await asyncio.sleep(2)
                         if not source_blob.exists():
                              raise Exception(f"Generated video blob not found at {uri}")

                    # If the blob is already in our desired location/bucket, great.
                    # If not, we might want to copy it to output_filename for consistency?
                    # The output_filename was f"generated_videos/{uuid}.mp4"
                    # The source blob might be in a subdir or different name.
                    # Let's copy it to our standard location to be safe and consistent.
                    
                    destination_bucket = storage_client.bucket(BUCKET_NAME)
                    destination_blob = destination_bucket.blob(output_filename)
                    
                    if source_bucket_name == BUCKET_NAME and source_blob_name == output_filename:
                        print("DEBUG: Video already at destination.")
                    else:
                        print(f"DEBUG: Copying from {uri} to gs://{BUCKET_NAME}/{output_filename}")
                        source_bucket.copy_blob(source_blob, destination_bucket, output_filename)

                else:
                    # Handle HTTP URI (AI Studio)
                    print("DEBUG: Downloading generated video from HTTP URI...")
                    req = urllib.request.Request(uri)
                    if "googleapis.com" in uri:
                        req.add_header('x-goog-api-key', api_key)
                    
                    with urllib.request.urlopen(req) as response:
                        video_data = response.read()
                        
                    print(f"DEBUG: Uploading to GCS: {output_filename}")
                    upload_bytes(video_data, output_filename, content_type="video/mp4")
                
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
    
    return {"videos": results}

async def generate_video_reference(image: UploadFile, prompt: str, context: Optional[str] = None, num_videos: int = 1) -> Dict[str, List[Dict[str, str]]]:
    """
    Generates videos using a reference image (subject reference) with Veo 3.1.
    Returns a dict with 'videos' list containing 'video_url' and 'blob_name'.
    """
    if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
        client = genai.Client(
            vertexai=True,
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location=os.getenv("GOOGLE_CLOUD_LOCATION")
        )
        print("DEBUG: Using Vertex AI for reference image video generation")
    else:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise Exception("GEMINI_API_KEY not found")
        client = genai.Client(api_key=api_key)
        print("DEBUG: Using Gemini API for reference image video generation")

    # 1. Upload Input Image to GCS (Once)
    image_bytes = await image.read()
    input_filename = f"temp_inputs/{uuid.uuid4()}_ref.png"
    
    upload_bytes(image_bytes, input_filename, content_type=image.content_type)
    input_gcs_uri = f"gs://{BUCKET_NAME}/{input_filename}"
    
    print(f"DEBUG: Input reference image uploaded to {input_gcs_uri}")

    # 2. Construct Prompt
    full_prompt = prompt
    if context:
        full_prompt += f"\n\nContext / Brand Guidelines:\n{context}\n\nPlease ensure the video aligns with these guidelines."

    print(f"DEBUG: Generating {num_videos} videos with prompt: {full_prompt}")

    async def _generate_single_video():
        # 3. Call Veo Model
        try:
            output_filename = f"generated_videos/{uuid.uuid4()}.mp4"
            output_gcs_uri = f"gs://{BUCKET_NAME}/{output_filename}"
            
            config_params = {
                "aspect_ratio": "16:9",
            }
            
            # Prepare Reference Image
            if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
                config_params["output_gcs_uri"] = output_gcs_uri
                
                ref_image = types.VideoGenerationReferenceImage(
                    image=types.Image(
                        gcs_uri=input_gcs_uri,
                        mime_type=image.content_type
                    ),
                    reference_type="asset" 
                )
                config_params["reference_images"] = [ref_image]
            else:
                 ref_image = types.VideoGenerationReferenceImage(
                    image=types.Image(
                        image_bytes=image_bytes,
                        mime_type=image.content_type
                    ),
                    reference_type="asset"
                )
                 config_params["reference_images"] = [ref_image]

            # Get the running loop
            loop = asyncio.get_running_loop()

            def call_generate_videos():
                # Note: valid prompt is required even with reference image
                return client.models.generate_videos(
                    model="veo-3.1-generate-preview",
                    prompt=full_prompt,
                    config=types.GenerateVideosConfig(**config_params),
                )

            operation = await loop.run_in_executor(None, call_generate_videos)

            print("DEBUG: Video generation started. Waiting for completion...")
            
            # 4. Poll for completion
            while not operation.done:
                await asyncio.sleep(10)
                operation = await loop.run_in_executor(None, lambda: client.operations.get(operation))
                print("DEBUG: Waiting for reference image video generation...")

            if operation.error:
                raise Exception(f"Video generation failed: {operation.error}")
            
            # Handle Result (URI processing)
            if operation.result and operation.result.generated_videos:
                video = operation.result.generated_videos[0].video
                uri = video.uri
                 
                print(f"DEBUG: Video generation completed. URI: {uri}")
                 
                if not uri:
                     raise Exception("Generated video has no URI")

                # Handle GCS URI (gs://) or HTTP URI
                if uri.startswith("gs://"):
                    print("DEBUG: Handling gs:// URI directly")
                    # Parse bucket and blob name from uri: gs://bucket/blob_name
                    path_parts = uri[5:].split("/", 1)
                    if len(path_parts) != 2:
                         raise Exception(f"Invalid GCS URI: {uri}")
                    
                    source_bucket_name = path_parts[0]
                    source_blob_name = path_parts[1]
                    
                    from backend.services.storage import storage_client
                    source_bucket = storage_client.bucket(source_bucket_name)
                    source_blob = source_bucket.blob(source_blob_name)
                    
                    # Wait for consistency
                    if not source_blob.exists():
                         await asyncio.sleep(2)
                         if not source_blob.exists():
                             raise Exception(f"Generated video blob not found at {uri}")

                    destination_bucket = storage_client.bucket(BUCKET_NAME)
                    destination_blob = destination_bucket.blob(output_filename)
                    
                    if source_bucket_name == BUCKET_NAME and source_blob_name == output_filename:
                        print("DEBUG: Video already at destination.")
                    else:
                        print(f"DEBUG: Copying from {uri} to gs://{BUCKET_NAME}/{output_filename}")
                        source_bucket.copy_blob(source_blob, destination_bucket, output_filename)

                else:
                    # Handle HTTP URI (AI Studio)
                    print("DEBUG: Downloading generated video from HTTP URI...")
                    req = urllib.request.Request(uri)
                    if "googleapis.com" in uri:
                        req.add_header('x-goog-api-key', api_key)
                    
                    with urllib.request.urlopen(req) as response:
                        video_data = response.read()
                        
                    print(f"DEBUG: Uploading to GCS: {output_filename}")
                    upload_bytes(video_data, output_filename, content_type="video/mp4")
                
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
    
    return {"videos": results}

async def extend_video(video: UploadFile, prompt: str, context: Optional[str] = None, num_videos: int = 1) -> Dict[str, List[Dict[str, str]]]:
    """
    Extends a video using Veo 3.1.
    Returns a dict with 'videos' list containing 'video_url' and 'blob_name'.
    """
    if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
        client = genai.Client(
            vertexai=True,
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location=os.getenv("GOOGLE_CLOUD_LOCATION")
        )
        print("DEBUG: Using Vertex AI for video extension")
    else:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise Exception("GEMINI_API_KEY not found")
        client = genai.Client(api_key=api_key)
        print("DEBUG: Using Gemini API for video extension")

    # 1. Upload Input Video to GCS (Once)
    # Note: Veo extension requires GCS URI for input video in many cases, or we can pass bytes if small?
    # The doc example used a GCS URI. Let's upload to GCS to be safe and consistent.
    video_bytes = await video.read()
    input_filename = f"temp_inputs/{uuid.uuid4()}_extend_input.mp4"
    
    upload_bytes(video_bytes, input_filename, content_type=video.content_type)
    input_gcs_uri = f"gs://{BUCKET_NAME}/{input_filename}"
    
    print(f"DEBUG: Input video for extension uploaded to {input_gcs_uri}")

    # 2. Construct Prompt
    full_prompt = prompt
    if context:
        full_prompt += f"\n\nContext / Brand Guidelines:\n{context}\n\nPlease ensure the extension aligns with these guidelines."

    print(f"DEBUG: Extending video {num_videos} times with prompt: {full_prompt}")

    async def _generate_single_extension():
        # 3. Call Veo Model
        try:
            output_filename = f"generated_videos/{uuid.uuid4()}.mp4"
            output_gcs_uri = f"gs://{BUCKET_NAME}/{output_filename}"
            
            # Prepare Video Object
            if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
                video_input = types.Video(
                    uri=input_gcs_uri,
                    mime_type=video.content_type
                )
                config_params = {
                    "output_gcs_uri": output_gcs_uri,
                }
            else:
                video_input = types.Video(
                    uri=input_gcs_uri,
                    mime_type=video.content_type
                )
                config_params = {}

            # Get the running loop
            loop = asyncio.get_running_loop()

            def call_generate_videos():
                return client.models.generate_videos(
                    model="veo-3.1-generate-preview", # Using same model as per doc example for extension?
                    prompt=full_prompt,
                    video=video_input,
                    config=types.GenerateVideosConfig(**config_params),
                )

            operation = await loop.run_in_executor(None, call_generate_videos)

            print("DEBUG: Video extension started. Waiting for completion...")
            
            # 4. Poll for completion
            while not operation.done:
                await asyncio.sleep(10)
                operation = await loop.run_in_executor(None, lambda: client.operations.get(operation))
                print("DEBUG: Waiting for video extension...")

            if operation.error:
                raise Exception(f"Video extension failed: {operation.error}")
            
            # Handle Result
            if operation.result and operation.result.generated_videos:
                gen_video = operation.result.generated_videos[0].video
                uri = gen_video.uri
                 
                print(f"DEBUG: Video extension completed. URI: {uri}")
                 
                if not uri:
                     raise Exception("Generated video has no URI")

                # Handle GCS URI (gs://) or HTTP URI
                if uri.startswith("gs://"):
                    path_parts = uri[5:].split("/", 1)
                    if len(path_parts) != 2:
                         raise Exception(f"Invalid GCS URI: {uri}")
                    
                    source_bucket_name = path_parts[0]
                    source_blob_name = path_parts[1]
                    
                    from backend.services.storage import storage_client
                    source_bucket = storage_client.bucket(source_bucket_name)
                    source_blob = source_bucket.blob(source_blob_name)
                    
                    if not source_blob.exists():
                         await asyncio.sleep(2)
                         if not source_blob.exists():
                             raise Exception(f"Generated video blob not found at {uri}")

                    destination_bucket = storage_client.bucket(BUCKET_NAME)
                    destination_blob = destination_bucket.blob(output_filename)
                    
                    if source_bucket_name == BUCKET_NAME and source_blob_name == output_filename:
                        print("DEBUG: Video already at destination.")
                    else:
                        print(f"DEBUG: Copying from {uri} to gs://{BUCKET_NAME}/{output_filename}")
                        source_bucket.copy_blob(source_blob, destination_bucket, output_filename)

                else:
                    req = urllib.request.Request(uri)
                    if "googleapis.com" in uri and api_key:
                        req.add_header('x-goog-api-key', api_key)
                    
                    with urllib.request.urlopen(req) as response:
                        video_data = response.read()
                    
                    upload_bytes(video_data, output_filename, content_type="video/mp4")
                
                from backend.services.storage import generate_signed_url
                video_url = generate_signed_url(output_filename)
                
                return {
                    "video_url": video_url,
                    "blob_name": output_filename
                }
            else:
                raise Exception("No video generated in response")

        except Exception as e:
            print(f"Error extending video: {e}")
            raise e

    # Run concurrently
    tasks = [_generate_single_extension() for _ in range(num_videos)]
    results = await asyncio.gather(*tasks)
    
    return {"videos": results}

async def optimize_video_prompt(video: UploadFile, instructions: str) -> str:
    """
    Optimizes a prompt for video extension using Gemini 1.5 Pro (multimodal).
    """
    # 1. Setup Client
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

    # 2. Upload Video for Gemini Analysis
    # We need to upload to a location Gemini can read (File API or GCS).
    # For Video Magic, we are using the GenAI SDK.
    # We can upload the bytes directly if small, or use File API.
    # Video extension inputs might be large, so let's use the File API.
    
    video_bytes = await video.read()
    
    # We are using the GenAI SDK 'files' API for multimodal understanding
    # Create a temporary file
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_video:
        temp_video.write(video_bytes)
        temp_video_path = temp_video.name

    try:
        # Upload using the Files API (supports both Vertex and clean GenAI usually)
        # Note: In Vertex AI context, we might need GCS.
        # But for 'gemini-1.5-pro', it accepts parts.
        
        # Let's try uploading to the client's file store
        uploaded_file = client.files.upload(path=temp_video_path)
        
        # Wait for processing state if video
        while uploaded_file.state.name == "PROCESSING":
             print("Waiting for video to be processed for prompt optimization...")
             time.sleep(2)
             uploaded_file = client.files.get(name=uploaded_file.name)
             
        if uploaded_file.state.name == "FAILED":
             raise Exception("Video processing failed for optimization")

        # 3. Generate Content
        from backend.prompts.prompt_optimizer import PROMPT_OPTIMIZER_VIDEO_PROMPT
        prompt = PROMPT_OPTIMIZER_VIDEO_PROMPT.format(instructions=instructions)
        
        response = client.models.generate_content(
            model="gemini-1.5-pro-002", # Use a capable multimodal model
            contents=[uploaded_file, prompt]
        )
        
        return response.text.strip()

    finally:
        # Cleanup
        if os.path.exists(temp_video_path):
            os.unlink(temp_video_path) 
