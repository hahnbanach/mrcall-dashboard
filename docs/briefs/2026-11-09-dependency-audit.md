# Dependency audit: what reaches the browser first, then the development tools

## Intent

Bring the dashboard's dependencies out of the published advisories that can reach a user, and out of the ones that
reach a developer's machine where a fix exists, deciding each by what the dashboard actually ships rather than by the
count `npm audit` prints. The CTO asked for it on 2026-11-09, after the call id (`v2.2.55`).

## What was measured (2026-11-09, `v2.2` at `29fafcc`)

`npm audit --omit=dev`: 12 entries (7 high, 3 moderate, 2 low). `npm audit` with development dependencies: 56 (2
critical, 20 high). Exposure was measured against the source (`git grep` of every import) and against the JavaScript
`dashboard.mrcall.ai` publishes for `v2.2.55`: the two entry scripts of `index.html` and every chunk named by the app
bundle's chunk maps. Both phases below were simulated on a copy of `package.json` and `package-lock.json`
(`--package-lock-only`), and their residual audits are the ones stated under Acceptance.

### Runtime dependencies (`npm audit --omit=dev`)

| Package | How it arrives | Reaches the browser | Decision |
|---|---|---|---|
| `axios` 1.11.0 | direct, pinned; every StarChat and mrcall-agent call, through the default instance and its interceptor (`src/firebase/axiosConfig.js`) | yes: its version string is in the published vendor chunk | 1.21.0, same major, pinned; every listed advisory closes by 1.20.0 |
| `follow-redirects` 1.16.1 | `axios`, its Node HTTP adapter | no: absent from the published files; the browser build uses XHR and fetch | refresh inside `axios`'s range `^1.16.0` to 1.16.2 or later: upgrading `axios` alone leaves 1.16.1 locked |
| `google-auth-library` 9.15.1, and through it `gaxios` 6.7.1 and `uuid` 9.0.1 | direct | no: imported nowhere, absent from the published files | remove the dependency |
| `node-fetch` 3.3.2 | direct, and a `resolutions` entry (read by Yarn, not npm) | no: imported nowhere | remove both; Vue CLI keeps its own development-only `node-fetch` 2.7.0 |
| `vite` 6.3.4 | direct, under `dependencies` | no: the application is built by Vue CLI (webpack); `vite` is loaded only by `vitest.config.mjs` through `@vitejs/plugin-vue`, and by `vite.config.js`, which nothing reads | move to `devDependencies`, see the development phase |
| `fast-uri` 3.1.8 | `json-editor-vue` → `vanilla-jsoneditor` → `ajv`; also webpack's `schema-utils` → `ajv` at build time | no: `vanilla-jsoneditor` uses `ajv` only for `createAjvValidator`, which `src/` never calls, and its `sideEffects: false` lets webpack drop it; no `ajv` or `fast-uri` code is in the published files | refresh inside `ajv`'s range to 3.1.9 or later, so the runtime audit stops listing it |
| `firebase` 11.10.0 → `@firebase/firestore`, `@firebase/firestore-compat`, `@grpc/grpc-js` 1.9.16 | direct | no: `src/` imports only `firebase/app` and `firebase/auth`, and `grpc` is absent from the published files; `grpc-js` is a Node transport | none: every `firebase` sampled from 11.3.0 to 13.2.0 (`latest`) pins `grpc-js` `~1.9.0`, and npm's offered "fix" is a downgrade to `firebase` 9.14.0. Recorded |
| `vuex-persist` 3.1.3 → `deepmerge` 4.3.1 | direct | yes: it merges the persisted state read back from local storage | none: 3.1.3 is `vuex-persist`'s latest and needs `deepmerge` `^4.2.2`, whose latest 4.3.1 is in the advisory's range; npm's "fix" is a downgrade to 2.3.0. Exploiting it needs a write to that storage, which already means script running in the page. Recorded |

### Development dependencies (never published)

| Chain | Decision |
|---|---|
| `vitest` 2.1.9 (critical through `tinypool` and `@vitest/mocker`), its nested `vite` 5.4.21, `vite-node`, `esbuild` | `vitest` to the lowest major that clears them: 4.1.12 clears all six in the simulation. `vitest` 4 needs Node 20 or later, which the local machine has; the deploy (Node 18) installs it but does not run it |
| `vite` 6.3.4 (direct) | 6.4.6, pinned, in `devDependencies` |
| `@intlify/unplugin-vue-i18n` → `@intlify/vue-i18n-extensions` → `vue-i18n` 10.0.8 and three `@intlify` packages at 10.0.8 (high); `@typescript-eslint/typescript-estree` | remove `@intlify/unplugin-vue-i18n` and `vite.config.js`: only that file imports the plugin, and nothing reads the file. The shipped locales are plain JSON that webpack loads through the dynamic imports of `src/i18n/index.js`, with no i18n compiler plugin |
| `webpack` 5.97.1 (low) | 5.112.2, pinned as now |
| `body-parser`, `node-forge`, `undici`, `qs`, `joi`, `postcss-selector-parser`, `launch-editor` | lockfile refresh inside their declared ranges |
| Vue CLI 5: `@vue/cli-service`, `@vue/cli-plugin-router`, `@vue/cli-plugin-vuex`, `@vue/component-compiler-utils`, `vue-loader`, `postcss`, `webpack-dev-server`, `webpack-dev-middleware`, `sockjs` and its `uuid`, `copy-webpack-plugin`, `css-minimizer-webpack-plugin`, `serialize-javascript` | no fix published for Vue CLI 5. Recorded; leaving them means replacing the build tool (out of scope) |
| `vue-cli-plugin-compression` → `compression-webpack-plugin` | the only offered fix is a downgrade to 1.0.3. Recorded |
| `vue-cli-plugin-sitemap` 2.3.0 → `better-ajv-errors` 0.6.7 → `jsonpointer` | the only fix is a downgrade to `vue-cli-plugin-sitemap` 2.0.2, which has no `better-ajv-errors`; 2.3.0's `better-ajv-errors` 0.6.7 needs `jsonpointer` `^4.0.1`. Recorded |
| `eslint` 10 → `@eslint/config-array`, `minimatch`; `@eslint/js` | the only offered fix is a downgrade to `eslint` 9.39.5. Recorded |
| `@vue/test-utils` → `js-beautify`, `glob`, `editorconfig` | the only offered fix is a downgrade to 2.4.11. Recorded |

## Scope

Two phases, each releasable alone, the runtime phase first.

1. **Runtime.** `axios` to 1.21.0, pinned. Remove `google-auth-library` and `node-fetch` from `dependencies`, and
   the `resolutions` block's `node-fetch` entry. Move `vite` to `devDependencies`. Refresh `follow-redirects` and
   `fast-uri` inside their ranges.
2. **Development tools.** `vite` 6.4.6 and `webpack` 5.112.2, both pinned. `vitest` 4.1.12 or the lowest major that
   clears its advisories, with only mechanical edits to the 51 unit spec files. Remove `@intlify/unplugin-vue-i18n`
   and `vite.config.js`. Lockfile refreshes for the transitive packages listed above.

## Out of scope

- Replacing Vue CLI. Its advisories have no fix in Vue CLI 5; leaving them means moving the build to another tool,
  a workstream of its own with its own brief. Until then the development server stays a local tool.
- Every chain recorded above as having no fix or only a downgrade: none reaches a user through a path this brief can
  close.
- Adding a scheduled advisory job to CI. A runtime audit at high level would fail on the `firebase` chain, which
  has no fix, so such a job first needs a decided allowance for it; that is a separate decision for the CTO.
  Dependabot keeps reporting on the default branch `v2.2` meanwhile.
- `firebase` major upgrades for their own sake.

## Constraints

- Every authenticated request still goes through the configured Axios instance and its 401 interceptor; the
  interceptor's behaviour is the contract this upgrade must not move.
- Versions that were pinned stay pinned; ranges stay ranges. No `--force`, no `--legacy-peer-deps`.
- No visual baseline is re-recorded to make a run pass.
- The deploy builds with Node 18 (`.github/workflows/deploy.yml`) and the local machine runs a newer Node: a local
  build does not prove the deploy's, the test environment's deploy does.
- Release and deployment need the CTO's authorisation, phase by phase.

## Acceptance

- **Runtime phase.** `npm audit --omit=dev` lists exactly six entries: `firebase`, `@firebase/firestore`,
  `@firebase/firestore-compat`, `@grpc/grpc-js`, `vuex-persist` and `deepmerge`. `npm ls --depth=0` shows no
  `google-auth-library` and no `node-fetch`, and `axios@1.21.0`. The production build succeeds. The unit tests and
  the full Playwright run (three viewports) pass; a failure is either shown unrelated by rerunning it alone, as
  `docs/active-context.md` records for load-sensitive cases, or treated as a regression. The interceptor's tests
  (`tests/unit/sessionInterceptor.spec.js`, which drives real `axios` with a mocked adapter: session end, retry
  after refresh, a token-less 401 passing through; `tests/e2e/auth/session-errors.spec.js`) are among those that
  pass. After the deploy, the published vendor chunk of each environment carries `axios` 1.21.0.
- **Development phase.** `npm audit` lists exactly the six runtime entries plus the 26 development entries this
  brief records as having no fix or only a downgrade (the Vue CLI 5 chain, `vue-cli-plugin-compression`,
  `vue-cli-plugin-sitemap`, `eslint` and `@vue/test-utils`): 32 in all, none of them `vitest`, `tinypool`,
  `@vitest/mocker`, `vite`, `vite-node`, `esbuild`, `vue-i18n`, an `@intlify` package, `webpack`, or a package of
  the in-range refresh list. The unit tests pass on the new `vitest`; the build and the full Playwright run pass as
  above.

## Assumptions

- `axios` 1.11 to 1.21 is a minor-version line with no change the dashboard depends on. The package's own changelog
  (it stops at 1.19.0; the 1.20 and 1.21 notes were not read) lists hardening: own-property config reads,
  `formDataToJSON`, a strict protocol separator, synchronous interceptor failures no longer dispatching. The
  dashboard has one asynchronous response interceptor and no `FormData` in `src/`; the tests above are the measure,
  and a failure there refutes this assumption.
- Nothing outside `package.json` names `google-auth-library` or `node-fetch` (`git grep`), and nothing but
  `vite.config.js` imports `@intlify/unplugin-vue-i18n`.
