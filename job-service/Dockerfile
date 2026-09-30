FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build && chown -R node:node /app

USER node

CMD ["node", "dist/index.js"]
