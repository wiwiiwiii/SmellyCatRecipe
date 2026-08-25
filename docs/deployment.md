# Production Deployment

## Branch Strategy

Do not create feature work directly from `main` or a long-lived `prod` branch.

- `qa`: daily integration branch. Feature and fix branches start here.
- `feature/*`: product or backend features branched from `qa`.
- `fix/*`: bug fixes branched from `qa`.
- `release/x.y.z`: release-hardening branch from `qa`.
- `main`: production source of truth. Only release branches merge here.
- Git tags such as `v0.1.0`: immutable production deploy points.

If a temporary `prod` branch is ever required by hosting tooling, branch it from
`main`, keep it deployment-only, and do not develop against it.

```bash
git switch qa
git fetch --prune origin
git pull --ff-only origin qa
git switch -c release/0.1.0
npm run check
```

After verification, open a PR from `release/0.1.0` to `main`. Deploy only after
the `checks` status passes and the PR is merged.

## Server Layout

Recommended single-server layout:

- Docker and Docker Compose run the API and PostgreSQL.
- PostgreSQL data lives in the named volume `postgres-prod-data`.
- The API listens only on `127.0.0.1:3000`.
- Caddy or Nginx terminates HTTPS and proxies `/v1` traffic to
  `http://127.0.0.1:3000/v1`.
- The WeChat Mini Program request legal domain points to the HTTPS API host.

The production Compose file is `docker-compose.prod.yml`. The real production
environment file defaults to `.env.production`; it is ignored by Git. For local
syntax checks, override it with `PRODUCTION_ENV_FILE=.env.production.example`.

## Temporary IP Testing

IP testing is allowed for development and real-device debugging, but IP access is
not suitable for formal WeChat review or production release. IP 不能用于正式审核。
The final Mini Program upload still needs an HTTPS domain configured as a WeChat
request legal domain.

For a temporary server-IP test, expose the API on the server network interface:

```bash
API_HOST_BIND=0.0.0.0 docker compose -f docker-compose.prod.yml up -d --build
curl http://SERVER_IP:3000/health
```

Then set the Mini Program local debug API base URL to:

```js
const API_BASE_URL = "http://SERVER_IP:3000/v1";
```

In WeChat DevTools, use development or real-device debugging with domain/TLS
checks disabled. Do not submit this IP configuration for formal review.

## First Deploy

On the server:

```bash
git clone git@github.com:wiwiiwiii/SmellyCatRecipe.git
cd SmellyCatRecipe
git switch main
git pull --ff-only origin main
cp .env.production.example .env.production
```

Edit `.env.production` on the server and fill every production value:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `TOKEN_SECRET`
- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `WECHAT_CAT_OPENIDS`
- `WECHAT_MASTER_OPENIDS`
- `WECHAT_TEMPLATE_*` subscription template IDs

Then start the stack:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl http://127.0.0.1:3000/health
```

Validate the Compose file without production secrets:

```bash
PRODUCTION_ENV_FILE=.env.production.example docker compose -f docker-compose.prod.yml config
```

The API container runs migrations and menu seeding before starting the server.
The seed script is idempotent for the current menu data.

## Upgrade Deploy

Deploy a new release tag from `main`:

```bash
cd SmellyCatRecipe
git fetch --prune origin --tags
git switch main
git pull --ff-only origin main
npm run check
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs --tail=100 api
curl http://127.0.0.1:3000/health
```

If deploying by tag instead of branch head:

```bash
git checkout v0.1.0
docker compose -f docker-compose.prod.yml up -d --build
```

## Reverse Proxy

Example Caddy route:

```caddyfile
api.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

Example Nginx route:

```nginx
server {
  listen 443 ssl http2;
  server_name api.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

## Mini Program Release Wiring

Before uploading a backend-connected Mini Program build:

1. Set `services/api-config.js` to the production HTTPS `/v1` base URL.
2. Add the API host to WeChat Mini Program request legal domains.
3. Compile in WeChat DevTools.
4. Test with the cat WeChat account and the master WeChat account.
5. Upload an experience version before formal release.

Do not commit local LAN API URLs, real openids, or AppSecret values.

## Rollback

Rollback to the previous known-good tag:

```bash
cd SmellyCatRecipe
git fetch --prune origin --tags
git checkout v0.0.9
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs --tail=100 api
curl http://127.0.0.1:3000/health
```

Database migrations are forward-only. If a migration needs reversal, add a new
corrective migration in a fix branch and release it through `qa` and `main`.

## Copilot Handoff

Give another Copilot or coding agent these facts before it starts:

- Work from `qa` for features/fixes and from `release/x.y.z` for release hardening.
- Run `git fetch --prune origin` before making changes.
- Do not commit `.env.production`, `docker-compose.override.yml`, real openids,
  AppSecret, token secrets, database passwords, or local LAN API URLs.
- Use `npm run check` as the required local gate.
- Keep production deploys sourced from `main` tags.
- Keep `main` and `qa` branch protection enabled with required `checks`.
