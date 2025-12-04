# Creative Studio

Creative Studio is a web application for fashion content creation, featuring:
- **Image Creation**: Generate and edit fashion images using Gemini 2.5.
- **Virtual Try-on**: Visualize clothes on models using AI.
- **Video Creation**: Create motion content with Veo.

## Project Structure
- `backend/`: FastAPI backend services.
- `frontend/`: HTML/CSS/JS frontend.
- `Dockerfile`: Container configuration.

## Setup

1. **Clone the repository**
2. **Create a virtual environment**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```
4. **Environment Variables**
   Copy `.env.example` to `.env` and fill in your Google Cloud credentials and API keys.
   ```bash
   cp .env.example .env
   ```

## Running Locally

```bash
uvicorn backend.main:app --reload --port 8080
```
Access the app at `http://localhost:8080`.

## Deployment to Google Cloud Run

1. **Ensure you have the Google Cloud SDK installed and authenticated.**
2. **Run the build script:**
   ```bash
   chmod +x build_and_deploy.sh
   ./build_and_deploy.sh
   ```
   
   Or manually:
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/creative-studio .
   gcloud run deploy creative-studio --image gcr.io/YOUR_PROJECT_ID/creative-studio --platform managed --allow-unauthenticated
   ```

## Services
- **Image Creation**: Uses `google-genai` SDK (Gemini 2.5).
- **Virtual Try-on**: Uses Google Cloud Vertex AI / Gemini Vision capabilities.
- **Video Creation**: Uses Veo model via Gemini API.
