# Irya API

Backend API for the Irya portal.

## Stack

- Node.js
- Express
- Prisma ORM
- PostgreSQL
- JWT authentication

## Requirements

- Node.js 20+
- npm
- PostgreSQL (or Docker)

## Environment Variables

Create a `.env` file in the API root:

```env
DATABASE_URL=postgresql://postgres:postgres@db:5432/irya_dev
JWT_SECRET=your_jwt_secret
SERVICE_API_KEY=your_service_api_key
CORS_ORIGIN=https://mev.clinicawhim.com.br,https://www.mev.clinicawhim.com.br
```

Notes:

- `DATABASE_URL` must point to your target database.
- `CORS_ORIGIN` accepts a comma-separated allowlist.
- Localhost is already allowed by default in code.

## Install

```bash
npm install
```

## Run Locally

### Option 1: Docker Compose (recommended)

```bash
docker compose up --build
```

API runs on `http://localhost:3001`.

### Option 2: Node only

```bash
npm run dev
```

## Prisma

### Apply migrations

```bash
npx prisma migrate deploy --schema=prisma/schema.prisma
```

### Seed base questionnaire data

```bash
npm run seed
```

## Scripts

- `npm run dev`: run with watch mode
- `npm run start`: run in production mode
- `npm run seed`: seed questionnaire/pillar data

## Main Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/telefone-disponivel/:telefone`
- `GET /paciente/me`
- `PUT /paciente/me`
- `GET /questionario/estrutura`
- `GET /questionario/status`
- `POST /questionario/submeter`

## Railway Deployment

Set these variables in the `irya-api` service:

- `DATABASE_URL` (internal Postgres URL for runtime)
- `JWT_SECRET`
- `SERVICE_API_KEY`
- `CORS_ORIGIN`

Important:

- Do not set `PORT` manually.
- The app reads `process.env.PORT` automatically.

### Run migrations in production

If running the command from your local machine through Railway CLI, use the public DB URL:

```bash
railway run --service irya-api -- sh -lc 'DATABASE_URL="<DATABASE_PUBLIC_URL>" npx prisma migrate deploy --schema=prisma/schema.prisma'
```

## Health Check

```bash
GET /
```

Expected response: `API Irya está rodando!`

