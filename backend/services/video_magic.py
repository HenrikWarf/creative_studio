import os
import json
from google import genai
from google.genai import types
from typing import List, Dict

async def generate_script(prompt: str, context: str = None) -> List[Dict[str, str]]:
    """
    Generates a video script using Gemini 2.5 Flash.
    Returns a list of scenes, each with 'visual' and 'audio' keys.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise Exception("GEMINI_API_KEY not found")

    client = genai.Client(api_key=api_key)
    
    # Construct the prompt
    full_prompt = f"""
    You are an expert video scriptwriter. Your task is to create a compelling video script based on the user's request.
    
    User Prompt: {prompt}
    
    """
    
    if context:
        full_prompt += f"""
        Context / Brand Guidelines:
        {context}
        
        Please ensure the script aligns with these guidelines.
        """
        
    full_prompt += """
    Output Format:
    Return ONLY a JSON array of objects. Each object represents a scene and must have exactly two keys:
    - "visual": A detailed description of what is seen on screen.
    - "audio": The dialogue, voiceover, sound effects, or music instructions.
    
    Example:
    [
        {"visual": "Close up of a coffee cup with steam rising.", "audio": "SFX: Gentle morning birds. VO: Start your day right."},
        {"visual": "Woman takes a sip and smiles.", "audio": "VO: With our new organic blend."}
    ]
    """

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
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise Exception("GEMINI_API_KEY not found")

    client = genai.Client(api_key=api_key)
    
    full_prompt = f"""
    You are an expert video script editor.
    
    Current Script (JSON):
    {json.dumps(current_script, indent=2)}
    
    User Instructions for Edit:
    {instructions}
    
    Please modify the script according to the instructions. Maintain the same JSON structure (array of objects with "visual" and "audio").
    Return ONLY the JSON array.
    """
    
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
