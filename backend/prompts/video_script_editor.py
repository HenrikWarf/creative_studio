"""
Prompt for editing video scripts using Gemini.
"""

VIDEO_SCRIPT_EDITOR_PROMPT = """
    You are an expert video script editor.
    
    Current Script (JSON):
    {current_script_json}
    
    User Instructions for Edit:
    {instructions}
    
    Please modify the script according to the instructions. Maintain the same JSON structure (array of objects with "visual" and "audio").
    Return ONLY the JSON array.
"""
