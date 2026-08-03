# Backend

## Scope

The backend is a small self-hosted Node.js service for the WeChat mini program. The current pre-deploy backbone includes:

- JSON health endpoint.
- WeChat login through `wx.login()` code exchange and server-issued app tokens.
- Owner/cat role mapping from configured WeChat `openid` values.
- PostgreSQL connection.
- Versioned SQL migrations.
- Menu item repository and owner menu write endpoints.
- Order creation, current/history reads, read markers, owner cooking actions, replacement confirmation, and cancellation.
- WeChat subscription message sending, subscription-result recording, and notification logs.
- Menu seed script based on the current mini program menu data.

## Requirements

- Node.js 22 or compatible modern Node runtime.
- PostgreSQL 14+.
- `DATABASE_URL` pointing at the target database.
- `TOKEN_SECRET` set to a long random value.
- WeChat Mini Program AppID/AppSecret and the bound owner/cat `openid` values.

Example local database:

```bash
createdb smelly_cat_recipe
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/smelly_cat_recipe
export TOKEN_SECRET=local-development-secret-change-before-deploy
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

Start local Postgres and API with Docker:

```bash
docker compose up --build
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
TOKEN_SECRET=replace-with-a-long-random-secret
WECHAT_APP_ID=replace-with-wechat-mini-program-app-id
WECHAT_APP_SECRET=replace-with-wechat-mini-program-app-secret
WECHAT_CAT_OPENIDS=cat-openid
WECHAT_OWNER_OPENIDS=owner-openid
WECHAT_ALLOW_UNKNOWN_CAT=false
WECHAT_MINIPROGRAM_STATE=formal
WECHAT_TEMPLATE_OWNER_NEW_ORDER=
WECHAT_TEMPLATE_CAT_REPLACEMENT_REQUESTED=
WECHAT_TEMPLATE_CAT_ORDER_ACCEPTED=
WECHAT_TEMPLATE_CAT_ORDER_COOKING=
WECHAT_TEMPLATE_CAT_ORDER_COMPLETED=
```

`WECHAT_ALLOW_UNKNOWN_CAT=false` is the production default for a private app. Any WeChat user whose `openid` is not listed in `WECHAT_CAT_OPENIDS` or `WECHAT_OWNER_OPENIDS` receives `WECHAT_OPENID_NOT_ALLOWED`.

Subscription message sending uses the configured template IDs. Choose WeChat templates whose fields match the backend payload:

- `thing1`: short status title, for example `咪点了晚饭`.
- `thing2`: dish summary, for example `番茄炒蛋盖饭`.
- `time3`: update time, formatted as `YYYY-MM-DD HH:mm`.

Use `WECHAT_MINIPROGRAM_STATE=trial` for experience-version testing and `formal` for release.

## Mini Program Connection

Set `API_BASE_URL` in `config/api.js` to the HTTPS API base URL before uploading a backend-connected build:

```js
const API_BASE_URL = "https://api.example.com/v1";
```

Leave it blank for mock-only local UI work.

The Mini Program must add the API host as a WeChat `request` legal domain before real-device testing or release upload.

## Deployment Checklist

1. Provision PostgreSQL and set all backend environment variables, including WeChat template IDs.
2. Run `npm run backend:migrate` against the production database.
3. Run `npm run backend:seed` once to load the starter menu.
4. Start `node backend/server.js` behind an HTTPS domain.
5. Set `config/api.js` to the production `/v1` base URL.
6. Configure the same API host in the WeChat Mini Program request legal domain list.
7. Use WeChat DevTools to compile, preview on both identities, then upload an experience version.
