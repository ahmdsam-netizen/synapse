FROM node:20-alpine

WORKDIR /app

# Install deps first (cached layer unless package files change)
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

# Compile TypeScript to dist/ and adjust file ownership to non-root user
RUN npm run build && chown -R node:node /app

USER node

EXPOSE 4000

# In production: run migrations then start the compiled server.
# Seeds are intentionally omitted from production startup.
CMD ["sh", "-c", "npm run migrate && npm run start"]
