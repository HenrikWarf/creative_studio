import os
from google.cloud import storage
import uuid
import datetime

# Initialize client
# We assume GOOGLE_APPLICATION_CREDENTIALS is set or we are in an environment with default credentials
storage_client = storage.Client()

BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "creative-studio-assets")

def upload_file(file_obj, destination_blob_name: str, content_type: str = None) -> str:
    """
    Uploads a file-like object to the bucket.
    Returns the public URL of the uploaded file.
    """
    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(destination_blob_name)
        
        blob.upload_from_file(file_obj, content_type=content_type)
        
        print(f"DEBUG: Uploaded file to {destination_blob_name}")
        
        # Return the blob name instead of the signed URL
        return destination_blob_name

    except Exception as e:
        print(f"Error uploading to GCS: {e}")
        # Raise the exception so it can be handled by the caller
        raise e

def generate_signed_url(blob_name: str) -> str:
    """Generates a signed URL for a blob."""
    try:
        if blob_name.startswith("Error"):
            return blob_name
            
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(blob_name)
        
        url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(hours=1),
            method="GET"
        )
        return url
    except Exception as e:
        print(f"Error generating signed URL: {e}")
        return blob_name

def upload_bytes(data: bytes, destination_blob_name: str, content_type: str = None) -> str:
    """Uploads bytes to the bucket."""
    import io
    return upload_file(io.BytesIO(data), destination_blob_name, content_type)
