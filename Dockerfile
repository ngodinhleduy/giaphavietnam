# Image chạy trên VPS hoặc NAS (Synology / QNAP / TrueNAS có Docker).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DB_FILE=/data/giapha.db STORAGE_DIR=/data/uploads
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/api/site >/dev/null || exit 1
CMD ["node", "--experimental-strip-types", "--no-warnings", "src/server/node.ts"]
