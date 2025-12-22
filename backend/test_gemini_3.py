from google import genai
from google.genai import types
import base64
import os
from dotenv import load_dotenv

# Load env vars if locally running
load_dotenv()

def generate():
  print(f"Project: {os.getenv('GOOGLE_CLOUD_PROJECT')}")
  print(f"Location: {os.getenv('GOOGLE_CLOUD_LOCATION')}")
  
  try:
      client = genai.Client(
          vertexai=True,
          project=os.getenv("GOOGLE_CLOUD_PROJECT"),
          location="global", # Search suggested global endpoint for preview models
      )

      model = "publishers/google/models/gemini-3-pro-image-preview"
      print(f"Testing model: {model}")
      
      contents = [
        types.Content(
          role="user",
          parts=[
             types.Part.from_text(text="Generate a cute image of a robot painting a canvas.")
          ]
        )
      ]

      generate_content_config = types.GenerateContentConfig(
        temperature = 1,
        top_p = 0.95,
        max_output_tokens = 32768,
        response_modalities = ["TEXT", "IMAGE"],
        image_config=types.ImageConfig(
          aspect_ratio="1:1",
          image_size="1K",
          output_mime_type="image/png",
        ),
      )

      # Using generate_content instead of stream for simplicity in this test, 
      # but config is what matters.
      response = client.models.generate_content(
        model = model,
        contents = contents,
        config = generate_content_config,
      )
      
      print("Success!")
      print(response)

  except Exception as e:
      print(f"Error: {e}")

if __name__ == "__main__":
    generate()
