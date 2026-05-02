import os
import json
import base64
import re
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load environment variables from .env file explicitly
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(env_path)

class RateLimitException(Exception):
    """Exception raised when the AI service returns a 429 or quota-related error."""
    pass

class GeminiNutritionService:
    """
    Service layer for interacting with Google's Gemini AI models.
    Provides multimodal (text and vision) capabilities for nutrition analysis, 
    recipe generation, and automated grocery list consolidation.
    """
    def __init__(self):
        """
        Initializes the GenAI client using the GEMINI_API_KEY from environment variables.
        Gracefully handles missing keys by setting self.client to None.
        """
        try:
            # genai.Client() expects GOOGLE_API_KEY, but our .env uses GEMINI_API_KEY
            api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
            self.client = genai.Client(api_key=api_key)
        except Exception as e:
            print(f"WARNING: Failed to initialize genai.Client. AI features will be disabled. Error: {e}")
            self.client = None
 
    def _clean_json_response(self, text):
        """
        Sanitizes the AI's raw text response to extract a valid JSON string.
        AI models often wrap JSON in markdown blocks (```json) or add conversational filler.
        This method uses regex to isolate the core JSON structure.
        """
        if not text:
            return ""
        
        # Try to find the first '{' or '[' and the last '}' or ']'
        try:
            # Use regex to find everything between the first and last JSON brackets
            match = re.search(r'([\[\{].*[\]\}])', text, re.DOTALL)
            if match:
                return match.group(1).strip()
        except:
            pass

        # Fallback to basic stripping if regex fails
        text = text.strip()
        text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.IGNORECASE | re.MULTILINE)
        text = re.sub(r'\s*```$', '', text, flags=re.IGNORECASE | re.MULTILINE)
        return text.strip()

    def analyze_meal_description(self, description):
        """
        Parses a natural language meal description into structured nutritional data.
        
        Logic:
        Constructs a prompt that instructs the model to return a JSON array of food items.
        Explicitly asks for 'Net Carbs' calculation (Total Carbs - Fiber) to support Keto tracking.
        """
        if not self.client:
            return None

        prompt = f"""
        Analyze the following meal description and provide the nutritional information in JSON format.
        Return a list of identified food items, each with:
        - "food_name": generic name of the food
        - "raw_food_name": the exact word or phrase from the description used to identify this item
        - "calories": estimated calories (kcal)
        - "protein": estimated protein (g)
        - "carbs": estimated Net Carbs (Total Carbs minus Dietary Fiber) (g)
        - "fat": estimated fat (g)
        - "serving_size": a friendly description of the serving size used for estimation (e.g., "1 medium bowl", "200g")
        
        Meal description: "{description}"
        
        Return ONLY the JSON array, no extra text.
        """
        
        try:
            response = self.client.models.generate_content(
                model='gemini-3-flash-preview',
                contents=prompt
            )
            content = self._clean_json_response(response.text)
            return json.loads(content)
        except Exception as e:
            print(f"Error calling Gemini API: {e}")
            return None

    def analyze_meal_image_with_modifications(self, base64_image, modifier_text):
        """
        Processes a food image and a text-based modification request.
        
        Logic:
        Uses a Multimodal prompt. If a user provides an image of a burger but adds 
        the modifier "no bun", the AI is instructed to identify the burger ingredients 
        and subtract the nutritional footprint of the bun before returning final macros.
        """
        if not self.client:
            return None

        prompt = f"""
        You are a Keto-Vision Agent. You will receive an image of a meal and a text modifier: "{modifier_text}".
        Identify the food in the image, but adjust the nutritional information based on the text modifier.
        For example, if the modifier says "no bun", you must subtract the macros for the bun (carbs in particular).
        
        IMPORTANT: For "carbs", you MUST explicitly calculate and return the Net Carbs (Total Carbs minus Dietary Fiber).
        
        Return a single JSON object mapping exactly to this schema:
        {{
            "food_name": "Modified Meal Name (e.g., Hamburger, No Bun)",
            "raw_food_name": "the core identified food item before modifications",
            "calories": (estimated total calories as float),
            "protein": (estimated protein as float),
            "carbs": (Net Carbs out as a float),
            "fat": (estimated fat as float)
        }}

        Return ONLY the JSON object, no markdown formatting or extra text.
        """

        try:
            # Decode base64 image data
            image_bytes = base64.b64decode(base64_image)
            image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
            
            # Send multimodal request using the new SDK
            response = self.client.models.generate_content(
                model='gemini-3-flash-preview',
                contents=[image_part, prompt]
            )
            
            content = self._clean_json_response(response.text)
            return json.loads(content)
        except Exception as e:
            print(f"Error calling Gemini Vision API: {e}")
            error_str = str(e).lower()
            if "429" in error_str or "quota" in error_str or "capacity" in error_str or "connect" in error_str or "timeout" in error_str:
                raise RateLimitException("AI servers are currently at capacity. Please try again later.")
            return None

    def generate_keto_recipe(self, ingredients_text):
        """
        Generates a creative keto recipe based on a user's available pantry items.
        Ensures all generated recipes remain under 10g net carbs per serving.
        """
        if not self.client:
            return None
            
        prompt = f"""
        Act as an expert keto chef. I have the following ingredients: "{ingredients_text}".
        Create a strictly keto recipe using these ingredients (under 10g net carbs per serving).
        Return ONLY a raw JSON object with this exact structure:
        {{
            "title": "string",
            "calories": 0,
            "protein": 0,
            "fat": 0,
            "net_carbs": 0,
            "ingredients": ["string"],
            "instructions": ["string"]
        }}
        Do NOT use markdown code blocks like ```json. Return just the raw JSON object.
        """
        
        try:
            response = self.client.models.generate_content(
                model='gemini-3-flash-preview',
                contents=prompt
            )
            content = self._clean_json_response(response.text)
            return json.loads(content)
        except Exception as e:
            print(f"Error calling Gemini API for recipe generation: {e}")
            error_str = str(e).lower()
            if "429" in error_str or "quota" in error_str or "capacity" in error_str or "connect" in error_str or "timeout" in error_str:
                raise RateLimitException("AI servers are currently at capacity. Please try again later.")
            return None

    def generate_meal_for_macros(self, remaining_macros):
        """
        Generates a customized recipe that fits within a specific set of remaining macros.
        Used by the 'AI Chef' to help users hit their daily targets without overshooting.
        """
        if not self.client:
            return None
            
        prompt = f"""
        Act as a professional chef and nutritionist. 
        Generate a delicious meal recipe that fits the following remaining daily macros strictly:
        - Calories: {remaining_macros.get('calories')} kcal
        - Protein: {remaining_macros.get('protein')} g
        - Net Carbs: {remaining_macros.get('net_carbs')} g
        - Fat: {remaining_macros.get('fat')} g
        
        The meal should be practical, healthy, and satisfying.
        
        Return ONLY a raw JSON object with this exact structure:
        {{
            "recipe_name": "string",
            "ingredients": ["string"],
            "instructions": ["string"],
            "prep_time": "string (e.g. 15 mins)",
            "macros": {{
                "calories": 0,
                "protein": 0,
                "net_carbs": 0,
                "fat": 0
            }}
        }}
        Do NOT use markdown code blocks like ```json. Return just the raw JSON object.
        """
        
        try:
            response = self.client.models.generate_content(
                model='gemini-3-flash-preview',
                contents=prompt
            )
            content = self._clean_json_response(response.text)
            return json.loads(content)
        except Exception as e:
            print(f"Error calling Gemini API for macro-specific recipe: {e}")
            error_str = str(e).lower()
            if "429" in error_str or "quota" in error_str or "capacity" in error_str or "connect" in error_str or "timeout" in error_str:
                raise RateLimitException("AI servers are currently at capacity. Please try again later.")
            return None

    def generate_grocery_list(self, ingredients_list):
        """
        Consolidates multiple ingredient lists into a single, organized grocery list.
        
        Logic:
        Summarizes quantities (e.g. '1 cup' + '2 cups' = '3 cups') and 
        categorizes items by grocery aisle to improve shopping efficiency.
        """
        if not self.client:
            return None
            
        prompt = f"""
        Act as a hyper-efficient nutritionist. I have a consolidated list of ingredients spanning multiple recipes: 
        {ingredients_list}
        
        Consolidate duplicates (e.g., if one recipe needs 1 cup spinach and another needs 2 cups, output 3 cups spinach).
        Categorize them by standard grocery store aisles (Produce, Meat, Dairy, Pantry, etc.).
        Return the response strictly as a JSON object with this exact structure:
        {{
            "categories": [
                {{
                    "name": "string",
                    "items": ["string"]
                }}
            ]
        }}
        Do NOT use markdown code blocks like ```json. Return just the raw JSON object.
        """
        
        try:
            response = self.client.models.generate_content(
                model='gemini-3-flash-preview',
                contents=prompt
            )
            content = self._clean_json_response(response.text)
            return json.loads(content)
        except Exception as e:
            print(f"Error calling Gemini API for grocery list: {e}")
            error_str = str(e).lower()
            if "429" in error_str or "quota" in error_str or "capacity" in error_str or "connect" in error_str or "timeout" in error_str:
                raise RateLimitException("AI servers are currently at capacity. Please try again later.")
            return None

# Singleton instance for global application use
gemini_service = GeminiNutritionService()
