FROM node:20-alpine
WORKDIR /app
COPY services/certificate-service/package*.json ./services/certificate-service/
WORKDIR /app/services/certificate-service
RUN npm ci --omit=dev
COPY services/certificate-service/ ./
COPY shared/ /app/shared/
EXPOSE 3002
CMD ["node", "src/index.js"]
