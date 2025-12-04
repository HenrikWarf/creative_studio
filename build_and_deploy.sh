#!/bin/bash

# Set variables
PROJECT_ID=$(gcloud config get-value project)
IMAGE_NAME="creative-studio"
REGION="us-central1"

echo "Building container image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$IMAGE_NAME .

echo "Deploying to Cloud Run..."
gcloud run deploy $IMAGE_NAME \
  --image gcr.io/$PROJECT_ID/$IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=$PROJECT_ID

echo "Deployment complete!"
