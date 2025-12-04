import os
from google import genai
from google.genai.types import RecontextImageSource, ProductImage, Image
from fastapi import UploadFile
from backend.services.storage import upload_bytes
import uuid

# Initialize client
# We should probably initialize this once or per request depending on thread safety, 
# but the client is usually thread safe.
# Initialize client for Vertex AI
# Virtual Try-on requires Vertex AI
client = genai.Client(
    vertexai=True,
    project=os.getenv("GOOGLE_CLOUD_PROJECT"),
    location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
)

from typing import List

async def process_virtual_try_on(person_image: UploadFile, clothing_images: List[UploadFile]) -> str:
    """
    Processes the virtual try-on request.
    Returns the path to the generated image.
    """
    current_person_image_bytes = await person_image.read()
    
    # Read all clothing images first
    clothing_images_bytes = []
    for img in clothing_images:
        clothing_images_bytes.append(await img.read())

    output_file = "output-image.png" # TODO: Generate unique filename or use temp file

    # Ensure environment variables are set (handled in main or config, but good to check)
    if not os.getenv("GOOGLE_CLOUD_PROJECT"):
        raise ValueError("GOOGLE_CLOUD_PROJECT environment variable not set.")
    
    try:
        print(f"DEBUG: Starting Virtual Try-on with model virtual-try-on-preview-08-04")
        
        # Note: recontext_image might require specific Image types. 
        # Based on previous fix, we should ensure we pass bytes and mime_type if possible,
        # or use the correct helper. The user code used Image(image_bytes=...).
        # Let's try to be explicit with types if the SDK allows, or wrap in try/except to catch SDK errors.
        
        # We need to check if Image accepts mime_type. In the previous file we used Blob.
        # But recontext_image expects RecontextImageSource which expects Image.
        # Let's assume Image(image_bytes=...) is correct for this specific method, 
        # BUT we should check if it needs mime_type too.
        
        # Let's try adding mime_type to Image constructor if it accepts it.
        # If not, we might need to use a different structure.
        # However, for now, let's wrap in try/except and log the error.
        
        # Loop through each clothing image and chain the results
        for i, cloth_bytes in enumerate(clothing_images_bytes):
            print(f"DEBUG: Processing garment {i+1}/{len(clothing_images_bytes)}")
            
            image = client.models.recontext_image(
                model="virtual-try-on-preview-08-04",
                source=RecontextImageSource(
                    person_image=Image(image_bytes=current_person_image_bytes),
                    product_images=[
                        ProductImage(product_image=Image(image_bytes=cloth_bytes))
                    ],
                ),
            )
            
            if not image.generated_images:
                 raise ValueError(f"No generated images in response for garment {i+1}")

            generated_img = image.generated_images[0].image
            
            if hasattr(generated_img, 'image_bytes') and generated_img.image_bytes:
                # Update current person image for next iteration
                current_person_image_bytes = generated_img.image_bytes
            else:
                raise ValueError(f"Could not extract bytes from generated image for garment {i+1}")
        
        # Final image is in current_person_image_bytes
        img_byte_arr = current_person_image_bytes
        
        print(f"DEBUG: VTO Response received")
        
        # Removed single image extraction logic as it is now inside the loop

        # Generate unique filename
        filename = f"{uuid.uuid4().hex}.png"
        
        # Upload to GCS
        image_url = upload_bytes(img_byte_arr, filename, content_type="image/png")
        print(f"DEBUG: Final VTO Image URL: {image_url}")
        
        return image_url
        
    except Exception as e:
        print(f"Error in Virtual Try-on: {e}")
        raise e
