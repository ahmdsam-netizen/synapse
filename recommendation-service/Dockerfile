FROM python:3.11-slim

WORKDIR /app

# Install build dependencies, install python packages, and purge compiler tools
COPY requirements.txt .
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y --auto-remove build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/.cache/fastembed && \
    chown -R appuser:appuser /app

ENV FASTEMBED_CACHE_PATH=/app/.cache/fastembed

COPY . .
RUN chown -R appuser:appuser /app

USER appuser

# Pre-download embedding model at build time under the non-root user
RUN python -c "from fastembed import TextEmbedding; TextEmbedding(model_name='sentence-transformers/all-MiniLM-L6-v2')"

EXPOSE 5000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "5000"]
