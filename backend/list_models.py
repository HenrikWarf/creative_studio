import os
from dotenv import load_dotenv
from google import genai

# Load env vars
load_dotenv()

project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
location = os.getenv("GOOGLE_CLOUD_LOCATION")

print(f"Project: {project_id}")
print(f"Location: {location}")

if not project_id or not location:
    print("Error: GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_LOCATION not set.")
    exit(1)

try:
    client = genai.Client(
        vertexai=True,
        project=project_id,
        location=location
    )
    
    print("\nListing available models:")
    # Note: method might differ slightly depending on SDK version, assuming standard list_models
    # genai.Client doesn't have list_models directly on it usually, it's on client.models
    for model in client.models.list(config={"page_size": 100}):
        print(f"- {model.name}")
        
except Exception as e:
    print(f"Error listing models: {e}")
