# Development and deployment

## Commands

The entry point is `src/main.js`. Package scripts use Vue CLI for both development and production builds.

```bash
npm run serve                    # Vue CLI development server, default port 8080
npm run build                    # Production build with Webpack
npm run lint                     # ESLint with automatic fixes
npm run test:unit                 # ESLint check, then vitest component and unit tests
npm run test:e2e                  # Playwright browser tests
npm run test:e2e:ui               # Interactive Playwright UI
npm run test:e2e:update-snapshots  # Update visual snapshots
npm run i18n:report               # Translation coverage report
npx playwright test tests/e2e/auth/businesses.spec.js
npx playwright test --grep "test name"
npx playwright test --project=desktop
```

## Browser tests

`playwright.config.js` configures `tests/e2e/`, with domain suites including `auth/`, `public/`, `admin/`, `responsive/`, and `visual/`. Page objects live in `tests/e2e/pages/`; fixtures live in `tests/e2e/fixtures/`.

The base URL is `http://localhost:8080`, or `http://localhost:$E2E_PORT` when `E2E_PORT` is set (for when another process holds 8080: a container bound to `[::1]:8080` answers `localhost` first); the fixtures read the same origin from `tests/e2e/fixtures/origin.js`, and the test server is started on that port. Desktop, tablet and mobile projects use widths of 1440, 768 and 375 pixels. Visual specs run only under the desktop project and select their own viewport sizes. The test server runs `npm run serve -- --mode test --port <port>`; the test process loads `.env.test` when present and otherwise `.env`. Supply local configuration before running the application; do not commit credentials.

Load times are measured with `scripts/measure-load.mjs` (Playwright Chromium): `--base <url> --page signin|businesses|analytics --profile unthrottled|10mbps [--cold 7] [--warm 5] [--locale en-US] [--out file.json]`. Per run it reports the splash, the page's first figure, bytes, requests, the token calls, and the chunks fetched before the figure with their gzip bytes. The `businesses` and `analytics` pages sign in fresh in each run with `MEASURE_EMAIL` and `MEASURE_PASSWORD` read from the environment (keep them in a file outside the repository, never in an argument); `analytics` opens the first of the account's businesses that shows a figure, or `MEASURE_BUSINESS_ID`.

## Environment routing

Deployment is owned by `.github/workflows/deploy.yml` in this repository.

| Environment | Deploy tag | Bucket | Domain |
|---|---|---|---|
| Test | `vX.Y.Z-test` | `mrcall-dashboard-test` | `dashboard-test.mrcall.ai` |
| Beta | `vX.Y.Z-beta` | `mrcall-dashboard-beta` | `dashboard-beta.mrcall.ai` |
| Production | `vX.Y.Z-production` | `mrcall-dashboard` | `dashboard.mrcall.ai` |

A bare `vX.Y.Z` tag marks a release and triggers no deployment. Promotion uses environment tags on the same commit. Branches use numbered names such as `v2.0`; there are no `test-env`, `beta-env`, or `production-env` branches.

The workflow selects its GitHub environment from the tag suffix, writes `.env.<mode>` from that environment's `ENV_FILE`, builds, gzips every `.js` and `.css` in place (`scripts/precompress.sh`: neither the bucket nor the edge negotiates encodings), and uploads with `scripts/deploy-assets.sh` to Scaleway Object Storage in `fr-par`. One deploy at a time per environment (the concurrency group is the environment, not the tag). Each GitHub environment supplies its own `SCW_ACCESS_KEY` and `SCW_SECRET_KEY`, in GitHub secrets, and `ASSET_CACHE_CONTROL`, a variable. Every `VUE_APP_*` value is public build configuration, never a place for private secrets.

`scripts/deploy-assets.sh` takes every argument explicitly and states why each step is where it is. In order: it refuses a `.js` or `.css` that is not gzip; records under `deploy-manifests/` the hashed keys this deploy takes out of service (`superseded-<UTC time>.txt`); uploads the assets (`.js` and `.css` with `Content-Encoding: gzip`; the hashed ones under `js/`, `css/`, `fonts/` and `img/` with `ASSET_CACHE_CONTROL`; an unhashed `.js` such as `MrCallWebCall.bundle.js` with `no-cache`); syncs the rest with `--delete`; writes `index.html` and its route copies (`scripts/static-routes.js`) last with `no-cache`; rewrites `deploy-manifests/current.txt`; and deletes a superseded asset 14 days after the deploy that replaced it, so that a tab opened before a deploy still finds the chunks it loads on demand. `ASSET_CACHE_CONTROL` is required: `none` sets no header, `public, max-age=60` is the probe that checks the edge keeps the header, `public, max-age=31536000, immutable` is the value after it. Changing it needs no new tag and no code change: rerun the workflow on the same tag, which rebuilds and rewrites every header. The app chunk's hash is not reproducible across builds of one commit, so a rerun can upload a new `app.*.js`; the previous build's file stays as a retained object with the header it was uploaded with, which content hashing makes harmless. All three environments carry `public, max-age=31536000, immutable` since `v2.2.49` (2026-11-03).

Before a change to the script reaches a bucket, `scripts/rehearse-deploy-assets.sh <base dist> <candidate dist>` runs it against a local S3 emulator (`moto_server`, `pipx install "moto[server]"`): headers per file type, upload order, route keys never absent, header-only redeploys, and retention over five deploys with backdated lists. A wrong header cached by the edge is removed by a purge in the Edge Services console, not by a redeploy; a redeploy of an older tag runs that tag's workflow and re-uploads its assets without the year-long header.

All environment builds explicitly set `NODE_ENV=production` and `BABEL_ENV=production` on the build step; `--mode` selects the environment file. Preserve that separation so test and beta receive production optimization. This documentation does not authorize a release or deployment.

## Related repositories

Cross-project ownership and operating context live in `~/hb/docs/`. Related working trees under `~/hb/` include `mrcall-agent/` (AI configuration backend), `starchat/` (telephony, CRM, payments and business configuration), and `mrcall-website/` (public website). Check the owning repository before merging a cross-project contract change. The dashboard uses `VUE_APP_ZYLCH_URL` for the AI backend and `VUE_APP_STARCHAT_URL` for StarChat.
