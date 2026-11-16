FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm ci
COPY apps/backend apps/backend
RUN npm run build -w @everafter/backend
ENV NODE_ENV=production
USER node
WORKDIR /app/apps/backend
EXPOSE 4000
CMD ["node", "dist/main.js"]
