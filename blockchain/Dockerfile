FROM node:20-alpine
WORKDIR /app/blockchain
COPY blockchain/package*.json ./
RUN npm ci
COPY blockchain/ ./
EXPOSE 8545
CMD ["npx", "hardhat", "node", "--hostname", "0.0.0.0"]
