FROM node:20-alpine
WORKDIR /app
COPY services/ipfs-service/package*.json ./services/ipfs-service/
WORKDIR /app/services/ipfs-service
RUN npm ci --omit=dev
COPY services/ipfs-service/ ./
COPY shared/ /app/shared/
EXPOSE 3004
CMD ["node", "src/index.js"]
