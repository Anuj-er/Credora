FROM node:20-alpine AS contract-builder
WORKDIR /app/blockchain
COPY blockchain/package*.json ./
RUN npm ci
COPY blockchain/ ./
RUN npx hardhat compile

FROM node:20-alpine
WORKDIR /app
COPY services/blockchain-service/package*.json ./services/blockchain-service/
WORKDIR /app/services/blockchain-service
RUN npm ci --omit=dev
COPY services/blockchain-service/ ./
COPY shared/ /app/shared/
COPY --from=contract-builder /app/blockchain/artifacts /app/blockchain/artifacts
EXPOSE 3003
CMD ["node", "src/index.js"]
