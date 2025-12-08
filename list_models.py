from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

try:
    print("Listing models...")
    for m in client.models.list():
        if "generate_videos" in (m.supported_actions or []):
            print(f"Video Model: {m.name}")
            print(f"  Supported Actions: {m.supported_actions}")
        elif "veo" in m.name:
             print(f"Veo Model (maybe): {m.name}")
             print(f"  Supported Actions: {m.supported_actions}")

except Exception as e:
    print(f"Error: {e}")
