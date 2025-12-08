# Creative Studio

Creative Studio is a comprehensive web application designed for fashion content creation. It leverages advanced AI models (Gemini 2.5, Veo) to streamline the workflow from ideation to asset generation.

## Key Features

### 1. Project Management & Context Engineering
-   **Projects**: Organize your work into projects.
-   **Context Engineering**: Define the "DNA" of your project and brand.
    -   **Brand Core**: Define Vibe, Lighting, Colors, and Subject for your brand.
    -   **Project Specifics**: Override or extend brand settings for specific campaigns.
    -   **Context Versions**: Save and manage multiple versions of your context to experiment with different styles.
    -   **Prompt Synthesis**: Automatically generates detailed prompts based on your defined context.

### 2. Image Creation
-   **Text-to-Image**: Generate high-quality fashion images using Gemini 2.5.
-   **Multi-Image Generation**: Generate 1-3 images simultaneously to explore variations.
-   **Reference Inputs**: Upload Style, Product, and Scene reference images to guide the generation.
-   **Style Presets**: Choose from predefined styles (e.g., Cinematic, Studio, Neon) or define your own.

### 3. Image Magic (Editing)
-   **AI Editing**: Modify existing images using natural language instructions (e.g., "Change the background to a beach").
-   **Multi-Image Editing**: Generate multiple edited versions at once.
-   **Context-Aware**: Uses your project's context to ensure edits align with the brand voice.

### 4. Virtual Try-On (VTO)
-   **Garment Transfer**: Visualize clothing items on models.
-   **Multi-Garment**: Try on multiple garments sequentially.

### 5. Video Creation
-   **Text-to-Video**: Generate short video clips using the Veo model.

## Tech Stack

-   **Frontend**: HTML5, CSS3 (Custom Design System), Vanilla JavaScript.
-   **Backend**: Python, FastAPI.
-   **AI Models**: Google Gemini 2.5 (Flash/Pro), Veo, Imagen 3.
-   **Storage**: Google Cloud Storage (GCS).
-   **Database**: SQLite (for local development/metadata).

## Setup

1.  **Clone the repository**
2.  **Create a virtual environment**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```
3.  **Install dependencies**
    ```bash
    pip install -r requirements.txt
    ```
4.  **Environment Variables**
    Create a `.env` file in the root directory with the following:
    ```env
    GOOGLE_API_KEY=your_api_key_here
    GCS_BUCKET_NAME=your_gcs_bucket_name
    GOOGLE_CLOUD_PROJECT=your_project_id
    ```
5.  **Google Cloud Authentication**
    Ensure you are authenticated with Google Cloud:
    ```bash
    gcloud auth application-default login
    ```

## Running Locally

```bash
uvicorn backend.main:app --reload --port 8080
```
Access the app at `http://localhost:8080`.

## Deployment

The application is containerized and ready for deployment to Google Cloud Run.

```bash
./build_and_deploy.sh
```
