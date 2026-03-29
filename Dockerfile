FROM node:22-alpine
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./

RUN npm ci --legacy-peer-deps

COPY . .

ARG MONGODB_URI
ENV MONGODB_URI=$MONGODB_URI
ENV NODE_ENV=production

RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]