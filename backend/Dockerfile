FROM python:3.11-slim

WORKDIR /app

# Install PostgreSQL client and build dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Make the startup script executable
RUN chmod +x start.sh

# Run the application
CMD ["bash", "/app/start.sh"] 