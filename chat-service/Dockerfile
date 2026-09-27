FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && chown -R node:node /app

USER node

EXPOSE 4001

CMD ["node", "dist/index.js"]
