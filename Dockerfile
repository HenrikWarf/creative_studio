FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend ./backend

# Copy frontend code
COPY frontend ./frontend

# Set environment variables
ENV PORT=8080

# Expose port
EXPOSE 8080

# Run the application
# We run from /app, so module path is backend.main
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
