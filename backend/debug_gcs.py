
import os
import sys
from google.cloud import storage
import datetime

# Load env vars
from dotenv import load_dotenv
load_dotenv()

def debug_gcs():
    print("--- Starting GCS Debug ---")
    
    # 1. Check Credentials
    creds = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    print(f"GOOGLE_APPLICATION_CREDENTIALS: {creds}")
    if not creds or not os.path.exists(creds):
        print("ERROR: Credentials file not found or env var not set.")
        return

    # 2. Initialize Client
    try:
        storage_client = storage.Client()
        print("Storage Client Initialized.")
    except Exception as e:
        print(f"ERROR: Failed to initialize storage client: {e}")
        return

    # 3. Check Bucket
    bucket_name = os.getenv("GCS_BUCKET_NAME", "creative-studio-assets")
    print(f"Bucket Name: {bucket_name}")
    
    try:
        bucket = storage_client.bucket(bucket_name)
        if not bucket.exists():
             print(f"ERROR: Bucket {bucket_name} does not exist.")
             return
        print(f"Bucket {bucket_name} exists.")
    except Exception as e:
         print(f"ERROR: Failed to check bucket existence: {e}")
         return

    # 4. List Blobs (top 5)
    try:
        blobs = list(storage_client.list_blobs(bucket_name, max_results=5))
        print(f"Found {len(blobs)} blobs (showing max 5):")
        for blob in blobs:
            print(f" - {blob.name}")
            
        if not blobs:
            print("WARNING: Bucket is empty.")
    except Exception as e:
        print(f"ERROR: Failed to list blobs: {e}")
        return

    # 5. Test Signed URL Generation (using first blob or a dummy)
    test_blob_name = blobs[0].name if blobs else "test_debug.txt"
    print(f"Testing Signed URL for: {test_blob_name}")
    
    try:
        blob = bucket.blob(test_blob_name)
        url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(minutes=15),
            method="GET"
        )
        print(f"Generated Signed URL: {url[:50]}...") # Truncate for safety
    except Exception as e:
        print(f"ERROR: Failed to generate signed URL: {e}")

    print("--- GCS Debug Finished ---")

if __name__ == "__main__":
    debug_gcs()
