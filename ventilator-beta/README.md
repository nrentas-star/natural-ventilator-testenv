# ventilator-beta server

The **live deployed** Express server behind `tools.moffittcorp.com` (PM2 app `ventilator-beta`, bound `127.0.0.1:3200` on the MOFFITT-MCP server). Nginx host-routes `tools.moffittcorp.com` → 3200.

This is the gateway-integrated beta environment (OTP→JWT auth, RBAC, MariaDB-backed feedback + test tracking). It is distinct from the simple `../server/index.js` in this repo.

## Layout

- `server.js` — entry; mounts routers, security headers, body/cookie parsing.
- `src/config.js` — env config (all required vars read at startup).
- `src/db.js` — mysql2 pool + queries (users, feedback, test cases/runs, deploys) + in-memory OTP store.
- `src/auth/` — `tokens.js` (JWT sign/verify), `otp.js` (Elastic Email OTP), `middleware.js` (`requireAuth`, `requireVentilatorBeta`, `requireCanDeploy`).
- `src/routes/` — `health`, `auth`, `tools`, `ventilator` (shell + calc + Beta panel UI), `beta` (test/feedback/deploy APIs), `feedback`.
- The calculator is served from `public/v213.html` (gitignored here; the canonical copy is this repo's root `public/index.html`).

## Required environment (.env on server — NEVER commit)

```
PORT=3200
NODE_ENV=production
JWT_SECRET=...            # shared with the connect gateway
COOKIE_NAME=mcp_portal
COOKIE_DOMAIN=.moffittcorp.com
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
EE_API_KEY=...
EE_FROM=noreply@moffittcorp.com
FEEDBACK_NOTIFY=nrentas@moffittcorp.com,wwacker@moffittcorp.com
OTP_TTL=300
OTP_MAX_ATTEMPTS=5
```

## Deploy / run

```
set -a && source .env && set +a
pm2 start ecosystem.config.cjs --update-env
```

Beta users can deploy calculator updates from inside the tool (Updates tab) when their
`user_roles.can_deploy` flag is set: upload a new HTML file, or pull+publish from this repo's
`public/index.html`. Each deploy backs up the current `public/v213.html` to `public/backups/`.
