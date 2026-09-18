# ===================================================
# Stage 1: Build & Dependencies
# ===================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install openssl for Prisma engine
RUN apk add --no-cache openssl

# Install dependencies
COPY package*.json ./
COPY skills-lock.json ./
RUN npm ci

# Copy Prisma schema and configuration
COPY prisma ./prisma/
COPY prisma7.config.ts ./
RUN npx prisma generate

# Copy project source and configuration
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src/

# Compile NestJS app
RUN npm run build

# Remove development dependencies to keep image light
RUN npm prune --omit=dev

# ===================================================
# Stage 2: Production Runtime
# ===================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install openssl for Prisma runtime
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3000

# Security: Run as non-root user
USER node

# Copy built application and production dependencies
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node --from=builder /app/prisma7.config.ts ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
