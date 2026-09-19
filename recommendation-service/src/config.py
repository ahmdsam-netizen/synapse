import os

CORE_SERVICE_URL = os.getenv("CORE_SERVICE_URL", "http://core-service:4000")
VECTOR_DATABASE_URL = os.getenv("VECTOR_DATABASE_URL", "postgresql://synapse:synapse_dev@vectordb:5432/synapse_vectors")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
MODEL_NAME = os.getenv("MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")
PORT = int(os.getenv("PORT", "5000"))
