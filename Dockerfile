FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
ARG MONGODB_URI
ENV MONGODB_URI=$MONGODB_URI
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]