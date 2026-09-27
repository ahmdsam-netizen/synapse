import os
from dotenv import load_dotenv

load_dotenv()

CORE_SERVICE_URL = os.getenv("CORE_SERVICE_URL", "http://core-service:4000")
VECTOR_DATABASE_URL = os.getenv("VECTOR_DATABASE_URL", "postgresql://synapse:synapse_dev@vectordb:5432/synapse_vectors")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
GATEWAY_SECRET = os.getenv("GATEWAY_SECRET", "")
MODEL_NAME = os.getenv("MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")
PORT = int(os.getenv("PORT", "5000"))
NODE_ENV = os.getenv("NODE_ENV", "development")

if NODE_ENV == "production" and not os.getenv("VECTOR_DATABASE_URL"):
    raise RuntimeError("[Config Error] VECTOR_DATABASE_URL must be explicitly configured in production!")
