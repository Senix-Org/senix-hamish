FROM node:20-alpine

WORKDIR /app

# Install dependencies first to leverage Docker layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install --no-save tsx

# Copy only the worker- and library-relevant source.
COPY tsconfig.json ./
COPY worker ./worker
COPY src ./src

ENV NODE_ENV=production
ENV WORKER_LOG_FORMAT=json

CMD ["npx", "tsx", "worker/index.ts"]
