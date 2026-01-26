"""
Prompt for optimizing video generation prompts from images using Gemini.
"""

PROMPT_OPTIMIZER_PROMPT = """
    You are an expert video prompt engineer. 
    Analyze the provided image and the user's instructions: "{instructions}".
    
    Create a detailed, descriptive prompt for a video generation model (like Veo) that:
    1. Accurately describes the visual elements of the image (subject, setting, lighting, style).
    2. Incorporates the user's requested motion or transformation.
    3. Uses professional filmmaking terminology (e.g., "slow pan", "rack focus", "cinematic lighting").
    
    Output ONLY the optimized prompt text. Do not include any explanations or markdown formatting.
"""

PROMPT_OPTIMIZER_VIDEO_PROMPT = """
    You are an expert video prompt engineer.
    Analyze the provided video and the user's extension instructions: "{instructions}".

    Create a detailed, descriptive prompt for a video generation model (like Veo) to EXTEND this video.
    The prompt should:
    1. Describes the visual style and content of the existing video to ensure continuity.
    2. Incorporates the user's requested action or continuation smoothly.
    3. Uses professional filmmaking terminology.

    Output ONLY the optimized prompt text. Do not include any explanations or markdown formatting.
"""
