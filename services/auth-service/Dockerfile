FROM node:20-alpine
WORKDIR /app
COPY services/auth-service/package*.json ./services/auth-service/
WORKDIR /app/services/auth-service
RUN npm ci --omit=dev
COPY services/auth-service/ ./
COPY shared/ /app/shared/
EXPOSE 3001
CMD ["node", "src/index.js"]
