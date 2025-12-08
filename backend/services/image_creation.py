import os
from google import genai
from google.genai import types
from fastapi import UploadFile
from typing import List, Optional
from backend.services.storage import upload_bytes
import uuid
import base64
from backend.services.storage import upload_bytes
from backend import models
from sqlalchemy.orm import Session

client = genai.Client()

async def generate_image(
    prompt: str,
    model_name: str = "gemini-2.5-flash-image", # Or specific image model
    style: Optional[str] = None,
    reference_images: Optional[List[UploadFile]] = None,
    style_images: Optional[List[UploadFile]] = None,
    product_images: Optional[List[UploadFile]] = None,
    scene_images: Optional[List[UploadFile]] = None,
    num_images: int = 1
) -> List[str]:
    """
    Generates an image based on prompt and optional reference images.
    """
    
    # Construct the full prompt with style
    full_prompt = prompt
    if style:
        full_prompt = f"Style: {style}. {prompt}"
    
    contents = [full_prompt]
    
    async def process_images(images, instruction):
        if images:
            contents.append(f"\n{instruction}")
            for img in images:
                img_bytes = await img.read()
                print(f"DEBUG: Processing image {img.filename} with type {img.content_type}")
                contents.append(types.Part(
                    inline_data=types.Blob(
                        data=img_bytes, 
                        mime_type=img.content_type or "image/jpeg"
                    )
                ))
                await img.seek(0)

    await process_images(style_images, "Follow the artistic style, color palette, and visual texture of these reference images:")
    await process_images(product_images, "Incorporate the product shown in these images. Ensure the key features and appearance are maintained:")
    await process_images(scene_images, "Place the subject or product within the environment shown in these images. Match the lighting, perspective, and background details:")
    await process_images(reference_images, "Use these images as general visual references:")

    # Note: The exact API for image generation in the new SDK might differ.
    # Assuming standard generate_content or a specific image method.
    # If it's the Imagen model via Gemini API, it might be different.
    # But Gemini 2.5 is multimodal.
    
    # For "Image Creation", we might be using Imagen 3 or Gemini's image generation capabilities.
    # The user said "Gemini 2.5 Flash Image".
    
    generated_urls = []
    
    # Loop for multiple images
    for _ in range(num_images):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                # config=... # Add generation config if needed
            )
            
            print(f"DEBUG: Response candidates: {response.candidates}")
            if response.candidates and response.candidates[0].content:
                 print(f"DEBUG: First candidate content parts: {response.candidates[0].content.parts}")
            
            # Extract image from response
            generated_image_bytes = None
            
            # Check candidates
            if response.candidates and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if part.inline_data and part.inline_data.data:
                        generated_image_bytes = part.inline_data.data
                        break
            
            if not generated_image_bytes:
                raise ValueError("No image data found in response")

            # Generate unique filename
            filename = f"{uuid.uuid4().hex}.png"
            
            # Upload to GCS
            image_url = upload_bytes(generated_image_bytes, filename, content_type="image/png")
            print(f"DEBUG: Final Image URL: {image_url}")
            generated_urls.append(image_url)
            
        except Exception as e:
            print(f"Error generating image {_}: {e}")
            # Continue or raise? Let's continue and return what we have, or raise if all fail.
            # For now, let's raise to be safe, or we could return partial results.
            # Raising ensures the user knows something went wrong.
            raise e
    
    return generated_urls
        

async def edit_image(
    image_data: bytes,
    instruction: str,
    style: Optional[str] = None,
    reference_images: Optional[List[UploadFile]] = None,
    model_name: str = "gemini-2.5-flash-image"
) -> str:
    """
    Edits an existing image based on instructions. Returns Base64 string.
    """
    try:
        full_instruction = instruction
        if style:
            full_instruction = f"Style: {style}. {instruction}"
            
        contents = [full_instruction]
        
        # Add Reference Images
        if reference_images:
            contents.append("\nReference Images:")
            for img in reference_images:
                img_bytes = await img.read()
                contents.append(types.Part(
                    inline_data=types.Blob(
                        data=img_bytes, 
                        mime_type=img.content_type or "image/jpeg"
                    )
                ))
                await img.seek(0)

        # Add Image to Edit
        contents.append(types.Part(
            inline_data=types.Blob(
                data=image_data, 
                mime_type="image/png" # Assuming PNG for simplicity or detect
            )
        ))
        
        generated_images_b64 = []
    
        for _ in range(num_images):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents
                )
                
                print(f"DEBUG: Edit Response: {response}")
                
                generated_image_bytes = None
                
                if not response.candidates:
                     raise ValueError("No candidates returned from model.")
                     
                candidate = response.candidates[0]
                if not candidate.content:
                     print(f"DEBUG: Finish Reason: {candidate.finish_reason}")
                     raise ValueError(f"Model returned no content. Finish reason: {candidate.finish_reason}")

                if candidate.content.parts:
                    for part in candidate.content.parts:
                        if part.inline_data and part.inline_data.data:
                            generated_image_bytes = part.inline_data.data
                            break
                
                if not generated_image_bytes:
                    raise ValueError("No image data found in response")

                # Return as Base64 string
                generated_images_b64.append(base64.b64encode(generated_image_bytes).decode('utf-8'))
                
            except Exception as e:
                print(f"Error editing image {_}: {e}")
                raise e
                
        return generated_images_b64

    except Exception as e:
        print(f"Error editing image: {e}")
        raise e

async def save_image_asset(
    image_data_b64: str,
    project_id: int,
    prompt: str,
    db: Session,
    model_type: Optional[str] = None,
    context_version: Optional[str] = None,
    context_data: Optional[str] = None
) -> str:
    """
    Decodes Base64 image, uploads to GCS, and creates DB asset.
    """
    try:
        # Decode
        image_bytes = base64.b64decode(image_data_b64)
        
        # Upload
        filename = f"{uuid.uuid4().hex}.png"
        blob_name = upload_bytes(image_bytes, filename, content_type="image/png")
        
        # DB Entry
        asset = models.Asset(
            project_id=project_id,
            type="image",
            url=blob_name,
            prompt=prompt,
            model_type=model_type,
            context_version=context_version,
            context_data=context_data
        )
        db.add(asset)
        db.commit()
        
        return blob_name
    except Exception as e:
        print(f"Error saving image asset: {e}")
        raise e

async def optimize_prompt_text(
    prompt: str,
    model_name: str = "gemini-2.5-flash"
) -> str:
    """
    Optimizes a prompt for image generation using Gemini.
    """
    try:
        system_instruction = (
            "You are an expert prompt engineer for AI image generation models. "
            "Your task is to rewrite the user's prompt to be more descriptive, detailed, and optimized for high-quality image generation. "
            "Focus on visual details, lighting, style, and composition. "
            "Do NOT add subjects or elements that the user did not mention. "
            "Respect the user's original intent and goal. "
            "Output ONLY the optimized prompt text, nothing else."
        )
        
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7
            )
        )
        
        if response.text:
            return response.text.strip()
        else:
            return prompt # Fallback
            
    except Exception as e:
        print(f"Error optimizing prompt: {e}")
        raise e
