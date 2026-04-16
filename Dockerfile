# stage 1 deps
FROM node:22-alpine AS deps
RUN --mount=type=cache,target=/var/cache/apk \
    apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

# stage 2 builder
FROM node:22-alpine AS builder
WORKDIR /app

# grab the node modules we just installed
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG MONGODB_URI
ENV MONGODB_URI=$MONGODB_URI
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# stage 3 runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# running as root is bad practice so we make a nextjs user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# set up the cache directory permissions
RUN mkdir .next
RUN chown nextjs:nodejs .next

# the standalone mode bundles everything into this server.js file
# so we dont even need the original node_modules folder here
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# run the optimized server instead of npm start
CMD ["node", "server.js"]