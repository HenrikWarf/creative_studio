
import os
import uuid
import urllib.request
import asyncio
from typing import List, Dict, Optional
from fastapi import UploadFile
from google import genai
from google.genai import types
from backend.services.storage import BUCKET_NAME, upload_bytes, generate_signed_url, storage_client

async def generate_image_to_video(image: UploadFile, prompt: str, context: str = None, num_videos: int = 1) -> List[dict]:
    if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
        client = genai.Client(vertexai=True, project=os.getenv("GOOGLE_CLOUD_PROJECT"), location=os.getenv("GOOGLE_CLOUD_LOCATION"))
    else:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key: raise Exception("GEMINI_API_KEY not found")
        client = genai.Client(api_key=api_key)

    image_bytes = await image.read()
    input_filename = f"temp_inputs/{uuid.uuid4()}.png"
    upload_bytes(image_bytes, input_filename, content_type=image.content_type)
    input_gcs_uri = f"gs://{BUCKET_NAME}/{input_filename}"
    
    full_prompt = prompt
    if context: full_prompt += f"\n\nContext / Brand Guidelines:\n{context}\n\nPlease ensure the video aligns with these guidelines."

    async def _generate_single_video():
        try:
            output_filename = f"generated_videos/{uuid.uuid4()}.mp4"
            output_gcs_uri = f"gs://{BUCKET_NAME}/{output_filename}"
            config_params = {"aspect_ratio": "16:9"}
            
            if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True": config_params["output_gcs_uri"] = output_gcs_uri

            loop = asyncio.get_running_loop()
            def call_generate_videos():
                return client.models.generate_videos(
                    model="veo-3.1-generate-preview",
                    prompt=full_prompt,
                    image=types.Image(gcs_uri=input_gcs_uri, mime_type=image.content_type) if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True" else types.Image(image_bytes=image_bytes, mime_type=image.content_type),
                    config=types.GenerateVideosConfig(**config_params),
                )

            operation = await loop.run_in_executor(None, call_generate_videos)
            while not operation.done:
                await asyncio.sleep(10)
                operation = await loop.run_in_executor(None, lambda: client.operations.get(operation))

            if operation.error: raise Exception(f"Video generation failed: {operation.error}")

            if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
                found_blob = None
                bucket = storage_client.bucket(BUCKET_NAME)
                for _ in range(10):
                    blobs = list(bucket.list_blobs(prefix=output_filename))
                    if blobs:
                         video_blobs = [b for b in blobs if b.name.endswith('.mp4')]
                         if video_blobs: found_blob = video_blobs[0]; break
                    await asyncio.sleep(2)
                
                if not found_blob:
                     blob = bucket.blob(output_filename)
                     if blob.exists(): found_blob = blob

                if found_blob:
                    if found_blob.name != output_filename: bucket.rename_blob(found_blob, output_filename)
                    final_blob = bucket.blob(output_filename)
                    final_blob.content_type = "video/mp4"
                    final_blob.patch()
                    video_url = generate_signed_url(output_filename)
                    return {"video_url": video_url, "blob_name": output_filename}
                else: raise Exception("Could not locate generated video in GCS")
            else:
                if operation.result and operation.result.generated_videos:
                    uri = operation.result.generated_videos[0].video.uri
                    if not uri: raise Exception("Generated video has no URI")
                    req = urllib.request.Request(uri)
                    if "googleapis.com" in uri: req.add_header('x-goog-api-key', api_key)
                    with urllib.request.urlopen(req) as response: video_data = response.read()
                    upload_bytes(video_data, output_filename, content_type="video/mp4")
                    video_url = generate_signed_url(output_filename)
                    return {"video_url": video_url, "blob_name": output_filename}
                else: raise Exception("No video generated")
        except Exception as e: print(f"Error: {e}"); raise e

    tasks = [_generate_single_video() for _ in range(num_videos)]
    results = await asyncio.gather(*tasks)
    return results

async def generate_video_first_last(first_image: UploadFile, last_image: UploadFile, prompt: str, context: str = None, num_videos: int = 1) -> Dict[str, List[Dict[str, str]]]:
    if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
        client = genai.Client(vertexai=True, project=os.getenv("GOOGLE_CLOUD_PROJECT"), location=os.getenv("GOOGLE_CLOUD_LOCATION"))
    else:
        api_key = os.getenv("GEMINI_API_KEY"); client = genai.Client(api_key=api_key)

    first_image_bytes = await first_image.read()
    last_image_bytes = await last_image.read()
    first_filename = f"temp_inputs/{uuid.uuid4()}_first.png"
    last_filename = f"temp_inputs/{uuid.uuid4()}_last.png"
    upload_bytes(first_image_bytes, first_filename, content_type=first_image.content_type)
    upload_bytes(last_image_bytes, last_filename, content_type=last_image.content_type)
    first_gcs_uri = f"gs://{BUCKET_NAME}/{first_filename}"
    last_gcs_uri = f"gs://{BUCKET_NAME}/{last_filename}"
    
    full_prompt = prompt
    if context: full_prompt += f"\n\nContext / Brand Guidelines:\n{context}\n\nPlease ensure the video aligns with these guidelines."

    async def _generate_single_video():
        try:
            output_filename = f"generated_videos/{uuid.uuid4()}.mp4"
            output_gcs_uri = f"gs://{BUCKET_NAME}/{output_filename}"
            config_params = {"aspect_ratio": "16:9"}
            
            if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
                config_params["output_gcs_uri"] = output_gcs_uri
                config_params["last_frame"] = types.Image(gcs_uri=last_gcs_uri, mime_type=last_image.content_type)
            else:
                 config_params["last_frame"] = types.Image(image_bytes=last_image_bytes, mime_type=last_image.content_type)

            loop = asyncio.get_running_loop()
            def call_generate_videos():
                return client.models.generate_videos(
                    model="veo-3.1-generate-preview",
                    prompt=full_prompt,
                    image=types.Image(gcs_uri=first_gcs_uri, mime_type=first_image.content_type) if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True" else types.Image(image_bytes=first_image_bytes, mime_type=first_image.content_type),
                    config=types.GenerateVideosConfig(**config_params),
                )
            operation = await loop.run_in_executor(None, call_generate_videos)
            while not operation.done: await asyncio.sleep(10); operation = await loop.run_in_executor(None, lambda: client.operations.get(operation))
            if operation.error: raise Exception(f"Video generation failed: {operation.error}")

            if operation.result and operation.result.generated_videos:
                uri = operation.result.generated_videos[0].video.uri
                if uri.startswith("gs://"):
                    path_parts = uri[5:].split("/", 1)
                    source_bucket = storage_client.bucket(path_parts[0])
                    source_blob = source_bucket.blob(path_parts[1])
                    if not source_blob.exists(): await asyncio.sleep(2)
                    destination_bucket = storage_client.bucket(BUCKET_NAME)
                    if path_parts[0] != BUCKET_NAME or path_parts[1] != output_filename: source_bucket.copy_blob(source_blob, destination_bucket, output_filename)
                else:
                    req = urllib.request.Request(uri)
                    if "googleapis.com" in uri and api_key: req.add_header('x-goog-api-key', api_key)
                    with urllib.request.urlopen(req) as response: video_data = response.read()
                    upload_bytes(video_data, output_filename, content_type="video/mp4")
                
                video_url = generate_signed_url(output_filename)
                return {"video_url": video_url, "blob_name": output_filename}
            else: raise Exception("No video generated")
        except Exception as e: print(f"Error: {e}"); raise e

    tasks = [_generate_single_video() for _ in range(num_videos)]
    results = await asyncio.gather(*tasks)
    return {"videos": results}

async def generate_video_reference(image: UploadFile, prompt: str, context: Optional[str] = None, num_videos: int = 1) -> Dict[str, List[Dict[str, str]]]:
    if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True": client = genai.Client(vertexai=True, project=os.getenv("GOOGLE_CLOUD_PROJECT"), location=os.getenv("GOOGLE_CLOUD_LOCATION"))
    else: api_key = os.getenv("GEMINI_API_KEY"); client = genai.Client(api_key=api_key)

    image_bytes = await image.read()
    input_filename = f"temp_inputs/{uuid.uuid4()}_ref.png"
    upload_bytes(image_bytes, input_filename, content_type=image.content_type)
    input_gcs_uri = f"gs://{BUCKET_NAME}/{input_filename}"
    full_prompt = prompt
    if context: full_prompt += f"\n\nContext / Brand Guidelines:\n{context}\n\nPlease ensure the video aligns with these guidelines."

    async def _generate_single_video():
        try:
            output_filename = f"generated_videos/{uuid.uuid4()}.mp4"
            output_gcs_uri = f"gs://{BUCKET_NAME}/{output_filename}"
            config_params = {"aspect_ratio": "16:9"}
            
            if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
                config_params["output_gcs_uri"] = output_gcs_uri
                ref_image = types.VideoGenerationReferenceImage(image=types.Image(gcs_uri=input_gcs_uri, mime_type=image.content_type), reference_type="asset")
                config_params["reference_images"] = [ref_image]
            else:
                 ref_image = types.VideoGenerationReferenceImage(image=types.Image(image_bytes=image_bytes, mime_type=image.content_type), reference_type="asset")
                 config_params["reference_images"] = [ref_image]

            loop = asyncio.get_running_loop()
            def call_generate_videos():
                return client.models.generate_videos(model="veo-3.1-generate-preview", prompt=full_prompt, config=types.GenerateVideosConfig(**config_params))
            
            operation = await loop.run_in_executor(None, call_generate_videos)
            while not operation.done: await asyncio.sleep(10); operation = await loop.run_in_executor(None, lambda: client.operations.get(operation))
            if operation.error: raise Exception(f"Video generation failed: {operation.error}")

            if operation.result and operation.result.generated_videos:
                uri = operation.result.generated_videos[0].video.uri
                if uri.startswith("gs://"):
                    path_parts = uri[5:].split("/", 1)
                    source_bucket = storage_client.bucket(path_parts[0]); source_blob = source_bucket.blob(path_parts[1])
                    if not source_blob.exists(): await asyncio.sleep(2)
                    destination_bucket = storage_client.bucket(BUCKET_NAME)
                    if path_parts[0] != BUCKET_NAME or path_parts[1] != output_filename: source_bucket.copy_blob(source_blob, destination_bucket, output_filename)
                else:
                    req = urllib.request.Request(uri)
                    if "googleapis.com" in uri and api_key: req.add_header('x-goog-api-key', api_key)
                    with urllib.request.urlopen(req) as response: video_data = response.read()
                    upload_bytes(video_data, output_filename, content_type="video/mp4")
                return {"video_url": generate_signed_url(output_filename), "blob_name": output_filename}
            else: raise Exception("No video generated")
        except Exception as e: print(f"Error: {e}"); raise e

    tasks = [_generate_single_video() for _ in range(num_videos)]
    results = await asyncio.gather(*tasks)
    return {"videos": results}

async def extend_video(video: UploadFile, prompt: str, context: Optional[str] = None, num_videos: int = 1) -> Dict[str, List[Dict[str, str]]]:
    if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True": client = genai.Client(vertexai=True, project=os.getenv("GOOGLE_CLOUD_PROJECT"), location=os.getenv("GOOGLE_CLOUD_LOCATION"))
    else: api_key = os.getenv("GEMINI_API_KEY"); client = genai.Client(api_key=api_key)

    video_bytes = await video.read()
    input_filename = f"temp_inputs/{uuid.uuid4()}_extend_input.mp4"
    upload_bytes(video_bytes, input_filename, content_type=video.content_type)
    input_gcs_uri = f"gs://{BUCKET_NAME}/{input_filename}"
    full_prompt = prompt
    if context: full_prompt += f"\n\nContext / Brand Guidelines:\n{context}\n\nPlease ensure the extension aligns with these guidelines."

    async def _generate_single_extension():
        try:
            output_filename = f"generated_videos/{uuid.uuid4()}.mp4"
            output_gcs_uri = f"gs://{BUCKET_NAME}/{output_filename}"
            if os.getenv("GOOGLE_GENAI_USE_VERTEXAI") == "True":
                video_input = types.Video(uri=input_gcs_uri, mime_type=video.content_type)
                config_params = {"output_gcs_uri": output_gcs_uri}
            else:
                video_input = types.Video(uri=input_gcs_uri, mime_type=video.content_type)
                config_params = {}

            loop = asyncio.get_running_loop()
            def call_generate_videos():
                return client.models.generate_videos(model="veo-3.1-generate-preview", prompt=full_prompt, video=video_input, config=types.GenerateVideosConfig(**config_params))

            operation = await loop.run_in_executor(None, call_generate_videos)
            while not operation.done: await asyncio.sleep(10); operation = await loop.run_in_executor(None, lambda: client.operations.get(operation))
            if operation.error: raise Exception(f"Video extension failed: {operation.error}")

            if operation.result and operation.result.generated_videos:
                uri = operation.result.generated_videos[0].video.uri
                if uri.startswith("gs://"):
                    path_parts = uri[5:].split("/", 1)
                    source_bucket = storage_client.bucket(path_parts[0]); source_blob = source_bucket.blob(path_parts[1])
                    if not source_blob.exists(): await asyncio.sleep(2)
                    destination_bucket = storage_client.bucket(BUCKET_NAME)
                    if path_parts[0] != BUCKET_NAME or path_parts[1] != output_filename: source_bucket.copy_blob(source_blob, destination_bucket, output_filename)
                else:
                    req = urllib.request.Request(uri)
                    if "googleapis.com" in uri and api_key: req.add_header('x-goog-api-key', api_key)
                    with urllib.request.urlopen(req) as response: video_data = response.read()
                    upload_bytes(video_data, output_filename, content_type="video/mp4")
                return {"video_url": generate_signed_url(output_filename), "blob_name": output_filename}
            else: raise Exception("No video generated")
        except Exception as e: print(f"Error: {e}"); raise e

    tasks = [_generate_single_extension() for _ in range(num_videos)]
    results = await asyncio.gather(*tasks)
    return {"videos": results}
