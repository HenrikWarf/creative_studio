# System Architecture & File Structure

This document explains how the "Content Creation Virtual Try-On" application is structured and how its different components interact.

## 1. High-Level Architecture

The application follows a standard **Client-Server** architecture:

-   **Frontend (Client)**: A Single Page Application (SPA) built with Vanilla JavaScript, HTML, and CSS. It runs in the user's browser.
-   **Backend (Server)**: A REST API built with Python and FastAPI. It handles business logic, database interactions, and calls to external AI services (Google Gemini).
-   **Database**: SQLite (`app.db`) for storing projects, assets, and context versions.
-   **File Storage**: Google Cloud Storage (GCS) for storing generated images and videos.
-   **AI Services**: Google Vertex AI / Gemini API for text, image, and video generation.

## 2. Directory Structure Overview

```
.
├── backend/                 # Python Server Code
│   ├── routers/            # API Endpoints (The "Interface")
│   ├── services/           # Business Logic (The "Brain")
│   ├── models.py           # Database Schema Definitions
│   ├── database.py         # Database Connection Setup
│   ├── config.py           # Centralized Configuration
│   └── main.py             # Application Entry Point
│
├── frontend/                # Client-Side Code
│   ├── index.html          # Main HTML Structure
│   ├── style.css           # Global Styles
│   ├── js/
│   │   ├── app.js          # Frontend Entry Point
│   │   ├── modules/        # Feature-Specific Logic
│   │   ├── utils.js        # Helper Functions
│   │   └── navigation.js   # SPA Navigation Logic
│
└── app.db                   # Local SQLite Database
```

## 3. Frontend Architecture (The "View")

The frontend is modularized using ES6 modules.

### Core Files
-   **`index.html`**: The skeleton of the application. It contains all the HTML for every section (Projects, Context, Image Creation, etc.). Sections are hidden/shown based on navigation.
-   **`js/app.js`**: The main entry point. It imports and initializes all the feature modules and navigation logic.
-   **`js/navigation.js`**: Handles the logic for switching tabs/sections. It listens for clicks on nav links and toggles the `active-section` class on the corresponding HTML `<section>`.

### Feature Modules (`js/modules/`)
Each major feature has its own JavaScript file to keep code organized.
-   **`project.js`**: Manages project creation, listing, and validation.
-   **`context.js`**: Handles the "Context Engineering" feature. It collects user input (brand vibe, goal), calls the backend to generate context, and updates the UI.
-   **`image-creation.js`**: Manages the Image Generation UI, sending prompts to the backend and displaying results.
-   **`video-magic/`**: A folder containing logic for the complex video generation features, split into sub-modules like `script-gen.js` and `image-to-video.js`.

### How it works
1.  **Initialization**: `index.html` loads `js/app.js` as a module.
2.  **Setup**: `app.js` calls `init()` functions for each module (e.g., `initContextEngineering()`).
3.  **Events**: Each module attaches event listeners to specific buttons in `index.html` (e.g., "Generate Context" button).

## 4. Backend Architecture (The "Controller")

The backend receives HTTP requests from the frontend and performs actions.

### Core Files
-   **`main.py`**: The entry point. It creates the FastAPI app, configures CORS (security), and includes all the `routers`. It also serves the `frontend` folder as static files.
-   **`config.py`**: Loads environment variables (API keys, model names) from `.env` so they aren't hardcoded.
-   **`database.py`**: Sets up the connection to the SQLite database.
-   **`models.py`**: Defines standard SQL tables (Projects, Assets, ContextVersions) using SQLAlchemy.

### Routers (`backend/routers/`)
Routers define the URL endpoints (e.g., `/api/projects`, `/context/generate`). They are the "doorway" to the server.
-   **`context.py`**: Handles requests related to context (e.g., `POST /context/generate`).
-   **`image_creation.py`**: Handles image generation requests.

### Services (`backend/services/`)
Services contain the actual logic and "heavy lifting". Routers call services.
-   **`image_creation.py`**: talks to the Google Gemini API to generate images.
-   **`storage.py`**: Handles uploading files to Google Cloud Storage.

## 5. Data Flow Example: Generating Context

Here is what happens when a user clicks **"Generate Context"**:

1.  **User Action**: User types a goal in `index.html` and clicks the "Generate" button.
2.  **Frontend (UI)**:
    -   `js/modules/context.js` detects the click.
    -   It gathers the text from the input field.
    -   It sends a `POST` request to `http://localhost:8080/context/generate` with the goal data.
3.  **Backend (Router)**:
    -   `backend/routers/context.py` receives the request at the `/generate` endpoint.
    -   It validates the data.
4.  **Backend (Service/Logic)**:
    -   The router constructs a prompt (e.g., "Act as a creative director...").
    -   It calls the Google Gemini API (via `google.genai` SDK).
5.  **AI Response**: Gemini returns a JSON object with "Brand Vibe", "Lighting", etc.
6.  **Backend Response**: The router sends this JSON back to the frontend.
7.  **Frontend (Update)**:
    -   `js/modules/context.js` receives the JSON.
    -   It finds the input fields in `index.html` (e.g., `id="ctx-brand-vibe"`) and sets their `.value` to the AI's response.

## 6. Key Concepts

-   **Modularization**: We avoid one giant file. Code is split by feature (Context, Image, Video).
-   **Async/Await**: Used in both JS and Python to handle operations that take time (like AI generation) without freezing the app.
-   **State Management**: The "source of truth" for the current project ID is stored in the frontend (`project.js` variable `currentProjectId`) and typically mirrored in `localStorage` for persistence across refreshes.
