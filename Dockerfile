FROM python:3.11-slim

#Set working directory inside the container
WORKDIR /app

#COPY backend and frontend
COPY backend ./backend
COPY frontend ./frontend

# Set the environment variable to avoid buffering and .pyc
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

#Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

#Expose port 8000 for FastAPI
EXPOSE 8000

#Set environment for production
ENV ENVIRONMENT=production

#Run Fast app using Uvicorn
RUN useradd --create-home appuser && chown -R appuser /app
USER appuser
# Run with uvicorn instead of gunicorn
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
