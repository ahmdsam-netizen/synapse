FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

RUN npm run build

EXPOSE 3001

CMD ["sh", "-c", "npm run migrate && npm run seed && npm run dev"]
