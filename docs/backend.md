# Backend

## Scope

The backend starts as a small self-hosted Node.js service for the WeChat mini program. The first backbone includes:

- JSON health endpoint.
- Development WeChat login stub.
- PostgreSQL connection.
- Versioned SQL migrations.
- Menu item repository and `GET /v1/menu-items`.
- Menu seed script based on the current mini program menu data.

Order creation, order state transitions, replacement requests, read markers, and WeChat subscription messages will be added in later backend feature branches against the existing API contract.

## Requirements

- Node.js 22 or compatible modern Node runtime.
- PostgreSQL 14+.
- `DATABASE_URL` pointing at the target database.

Example local database:

```bash
createdb smelly_cat_recipe
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/smelly_cat_recipe
```

## Commands

Install dependencies:

```bash
npm install
```

Apply migrations:

```bash
npm run backend:migrate
```

Seed menu items:

```bash
npm run backend:seed
```

Start the API:

```bash
npm run backend:dev
```

Check the server:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "service": "smelly-cat-recipe-api",
  "status": "ok"
}
```

## Migration Rules

- Every database structure change gets a new SQL file in `backend/db/migrations`.
- Migration filenames use an increasing numeric prefix, for example `001_initial_schema.sql`.
- The runner records applied migrations in `schema_migrations`.
- Migrations run in a transaction and are skipped if already recorded.
- Do not edit a migration after it has been merged and applied outside your local database. Add a new migration instead.

## Environment

Copy `.env.example` values into your local shell or deployment environment:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/smelly_cat_recipe
PORT=3000
PG_POOL_MAX=10
PGSSL=false
```
