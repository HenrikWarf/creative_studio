import os
import json
import time
from typing import List, Dict, Optional
from backend.services.image_creation import get_client
from google import genai
from google.genai import types
from backend.config import config
from backend.prompts.video_script_writer import VIDEO_SCRIPT_WRITER_PROMPT
from backend.prompts.video_script_editor import VIDEO_SCRIPT_EDITOR_PROMPT

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
    
    
    full_prompt = VIDEO_SCRIPT_WRITER_PROMPT.format(
        prompt=prompt,
        context_section=f"Context / Brand Guidelines:\n{context}\n\nPlease ensure the script aligns with these guidelines." if context else ""
    )
    
    try:
        response = client.models.generate_content(
            model=config.MODEL_TEXT_FAST,
            contents=full_prompt,
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
                response_schema={
                    "type": "OBJECT",
                    "properties": {
                        "global_elements": {
                            "type": "OBJECT",
                            "properties": {
                                "character": {"type": "STRING"},
                                "visual_style": {"type": "STRING"},
                                "audio_vibe": {"type": "STRING"},
                                "costume": {"type": "STRING"},
                                "color_palette": {"type": "STRING"},
                                "set_design": {"type": "STRING"},
                                "objects_props": {"type": "STRING"},
                                "filming_techniques": {"type": "STRING"},
                                "voice": {"type": "STRING"},
                            },
                        },
                        "scenes": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "visual": {"type": "STRING"},
                                    "audio": {"type": "STRING"},
                                },
                                "required": ["visual", "audio"]
                            }
                        }
                    },
                    "required": ["global_elements", "scenes"]
                }
            )
        )
        
        cleaned_json = clean_json_string(response.text)
        script_json = json.loads(cleaned_json)
        return script_json

    except Exception as e:
        print(f"Error generating script: {e}")
        try:
            print(f"Falling back to {config.MODEL_TEXT_FAST}...")
            response = client.models.generate_content(
                model=config.MODEL_TEXT_FAST,
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type='application/json'
                )
            )
            cleaned_json = clean_json_string(response.text)
            script_json = json.loads(cleaned_json)
            return script_json
        except Exception as e2:
             print(f"Fallback failed: {e2}")
             # Last ditch effort: Try to parse whatever we got
             try:
                 if response and response.text:
                    cleaned = clean_json_string(response.text)
                    return json.loads(cleaned)
             except:
                 pass
             raise Exception(f"Failed to generate script: {e2}")

def clean_json_string(json_string: str) -> str:
    """
    Cleans a JSON string from Markdown formatting.
    """
    if not json_string:
        return ""
    
    cleaned = json_string.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    
    return cleaned.strip()

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
                response_mime_type='application/json',
                response_schema={
                     "type": "ARRAY",
                     "items": {
                        "type": "OBJECT",
                        "properties": {
                            "visual": {"type": "STRING"},
                            "audio": {"type": "STRING"},
                        },
                        "required": ["visual", "audio"]
                    }
                }
            )
        )
        
        cleaned_json = clean_json_string(response.text)
        script_json = json.loads(cleaned_json)
        return script_json
    except Exception as e:
        try:
            response = client.models.generate_content(
                model='gemini-1.5-flash',
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type='application/json'
                )
            )
            cleaned_json = clean_json_string(response.text)
            script_json = json.loads(cleaned_json)
            return script_json
        except Exception as e2:
             raise Exception(f"Failed to edit script: {e2}")
