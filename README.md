# Link Expiry API 🚀

A production-ready, high-performance ephemeral message sharing backend built with **NestJS**, **Prisma ORM (v7)**, **PostgreSQL**, and **Redis**.

Provides secure, self-destructing links with customizable expiration times, read count limits, password hashing, and fast-path Redis caching.

---

## ✨ Features

- ⏱️ **Configurable TTL**: Set expiration times in seconds (e.g., 5 minutes, 1 hour, 24 hours).
- 🔥 **One-Time Burn on Read**: Secret destroys itself upon the first successful access.
- 🔢 **Visit Caps**: Limit the maximum number of accesses before automatic invalidation.
- 🔒 **Password Protection**: Passwords securely hashed with `bcrypt` (salted).
- ⚡ **Redis Fast-Path Caching**: Public, unconstrained links are cached in Redis with native TTL for sub-millisecond retrieval.
- 🧹 **Automated Garbage Collection**: Hourly `@Cron` worker purges expired records from PostgreSQL.
- 🛡️ **Rate Limiting & Security**: In-flight throttling to prevent brute-force attacks, robust CORS configuration, and strict payload validation pipes (`forbidNonWhitelisted`).
- 🩺 **Health Check Endpoint**: `/health` endpoint for Docker, Kubernetes, Render, Railway, or AWS container health monitoring.
- 📖 **Interactive Swagger UI**: Full OpenAPI 3.0 specification available at `/api/docs`.
- 🐳 **Docker & Docker Compose**: Multi-stage production container build and local orchestrator.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [NestJS 12](https://nestjs.com/) (Node.js TypeScript framework) |
| **Database ORM** | [Prisma 7](https://www.prisma.io/) with `@prisma/adapter-pg` |
| **Primary Database** | [PostgreSQL](https://www.postgresql.org/) |
| **Cache Layer** | [Redis](https://redis.io/) (`node-redis` v6) |
| **Password Hashing**| [bcrypt](https://github.com/kelektiv/node.bcrypt.js) |
| **Documentation** | [Swagger / OpenAPI](https://swagger.io/) |
| **Linter / Formatter**| [oxlint](https://oxc.rs/) & Prettier |
| **Testing** | [Jest](https://jestjs.io/) & Supertest |

---

## 📋 API Reference

Interactive Swagger documentation is available at `http://localhost:3000/api/docs`.

### 1. Health & Status
- **`GET /`** - Service status greeting
- **`GET /health`** - System health check (`status`, `uptime`, `timestamp`)

### 2. Create Temporary Link
- **`POST /links`**
- **Request Body**:
  ```json
  {
    "message": "My confidential message",
    "expiresIn": 3600,
    "oneTime": true,
    "maxVisits": 1,
    "password": "optional-secret-password"
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "code": "a1b2c3d4",
    "expiresAt": "2026-09-19T05:30:00.000Z"
  }
  ```

### 3. Access Public Temporary Link
- **`GET /links/:shortCode`**
- **Response (`200 OK`)**:
  ```json
  {
    "message": "My confidential message"
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Password is required for this link.
  - `404 Not Found`: Link code does not exist.
  - `410 Gone`: Link has expired, reached max visits, or was already burned.

### 4. Access Protected Temporary Link
- **`POST /links/:shortCode/access`**
- **Request Body**:
  ```json
  {
    "password": "optional-secret-password"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "message": "My confidential message"
  }
  ```

---

## ⚙️ Environment Configuration

Copy `.env.example` to create your local `.env` file:

```bash
cp .env.example .env
```

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | HTTP port the server listens on | `3000` |
| `NODE_ENV` | Environment mode | `production` / `development` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/link_expiry?schema=public` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `FRONTEND_URL` | Allowed CORS origins (comma-separated) | `https://link-expiry-ui.vercel.app,http://localhost:5173` |

---

## 🚀 Getting Started

### Option A: Docker Compose (Recommended for Local Dev)

Spin up PostgreSQL, Redis, and Link Expiry API in one command:

```bash
docker compose up --build
```

The API will be available at `http://localhost:3000` and Swagger docs at `http://localhost:3000/api/docs`.

### Option B: Local Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Update DATABASE_URL and REDIS_URL to match your local services
   ```

3. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

4. **Run database migrations**:
   ```bash
   npx prisma migrate deploy
   ```

5. **Start the application**:
   ```bash
   # Development watch mode
   npm run start:dev

   # Production build & start
   npm run build
   npm run start:prod
   ```

---

## 🧪 Testing & Code Quality

```bash
# Run Unit Tests
npm test

# Run Linter (Oxlint)
npm run lint

# Format codebase
npm run format

# Production compile check
npm run build
```

---

## 📦 Production Deployment

### Container Deployment
Build and run the multi-stage Docker image:

```bash
docker build -t link-expiry-api:latest .
docker run -p 3000:3000 --env-file .env link-expiry-api:latest
```

### Cloud Platforms (Render, Railway, Fly.io, AWS Mau)
1. Provide `DATABASE_URL` (managed PostgreSQL e.g., Supabase, Neon, AWS RDS).
2. Provide `REDIS_URL` (managed Redis e.g., Upstash, Redis Cloud, ElastiCache).
3. Set `FRONTEND_URL` to your client application's domain.
4. Set build command: `npm install && npx prisma generate && npm run build`.
5. Set start command: `npm run start:prod`.
6. Configure health check path: `/health`.

---

## 📄 License

MIT
