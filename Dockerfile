# Use Python slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install uv for fast package management
RUN pip install uv

# Copy project files
COPY pyproject.toml .
COPY app.py .
COPY templates/ templates/
COPY static/ static/
COPY examples/ examples/

# Install dependencies
RUN uv pip install --system flask

# Expose port
EXPOSE 5000

# Set environment variables
ENV FLASK_APP=app.py
ENV FLASK_ENV=production

WORKDIR /home/mateus

# Run the application
CMD ["python", "/app/app.py"]
