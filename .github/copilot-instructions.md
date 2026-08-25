# Copilot Instructions

This repository is the WeChat Mini Program and self-hosted backend for
`小狗咪的喂食器` / `Puppy Cat Feeder`.

## Working Branches

- Sync GitHub before development: `git fetch --prune origin`.
- Start product and backend work from `qa`.
- Use `feature/*` for feature work and `fix/*` for bug fixes.
- Use `release/x.y.z` from `qa` for release hardening.
- Merge releases to `main`; do not merge routine `qa` work directly to `main`.
- Treat production deploys as `main` tags, not as ongoing work on a `prod` branch.
- Keep `main` and `qa` protected with required status check `checks`.

## Safety Rules

- Never commit `.env`, `.env.local`, `.env.production`,
  `docker-compose.override.yml`, real openids, AppSecret values, token secrets,
  database passwords, or local LAN API URLs.
- `WECHAT_MASTER_OPENIDS` is the current production env name for the master
  account. `WECHAT_OWNER_OPENIDS` is accepted only as a legacy fallback.
- Backend identity is authoritative: Mini Program `wx.login` code goes to the
  backend, backend maps `openid` to `cat` or `owner`, frontend must not hardcode
  identity.
- Keep database changes migratable. Add new SQL files under
  `backend/db/migrations`; do not edit migrations that may already be applied.

## Verification

- Run `npm run check` before claiming implementation work is complete.
- Run targeted `node --test tests/name.test.js` while iterating.
- Use `node --check path/to/file.js` for changed JavaScript files when useful.
- If WeChat DevTools CLI is unavailable, still run repository checks and note the
  missing DevTools verification.

## Deployment

- Production backend deployment is documented in `docs/deployment.md`.
- Production Compose file: `docker-compose.prod.yml`.
- Production env example: `.env.production.example`.
- The API should bind to `127.0.0.1:3000` and sit behind HTTPS reverse proxy.
- Temporary IP testing may use `API_HOST_BIND=0.0.0.0`, but IP access is not a
  formal WeChat review or production release path.
- The Mini Program production build must point `services/api-config.js` to the
  HTTPS `/v1` base URL and the same host must be configured as a WeChat request
  legal domain.
