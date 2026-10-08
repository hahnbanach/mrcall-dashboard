# MrCall Dashboard — Documentation Index

<!-- doc-scope:start -->
Scope: Routes repository-wide dashboard architecture, development rules, integration guides, and work traces; application inventory belongs to the root AGENTS.md.
<!-- doc-scope:end -->

Entry point for this repository's documentation. Start here.

## Architecture and development

| File | Contents |
|------|----------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Vue component map, Vuex store, routing and data flow |
| [system-rules.md](system-rules.md) | Tech stack, coding standards |
| [execution-plans/](execution-plans/) | One file per workstream; lifecycle lives in YAML frontmatter, never in prose |

## Guides

| File | Contents |
|------|----------|
| [development.md](development.md) | Commands, browser tests, deployment and related repositories |
| [active-context-archive.md](active-context-archive.md) | Historical snapshots, preserved verbatim; outside startup context |
| [active-context.md](active-context.md) | Current state, unresolved constraints and next actions |
| [briefs/](briefs/) | Workstream objectives and design decisions |
| [harness-backlog.md](harness-backlog.md) | Documentation maintenance decisions |

## Integrations

| File | Contents |
|------|----------|
| [integration/zylch-integration.md](integration/zylch-integration.md) | mrcall-agent integration: chat, installed-skill preview/Save/recovery and supported OAuth handoff |

## Quick context

- **Stack**: Vue 3, PrimeVue 4, Vuex, Firebase Auth, Axios, vue-i18n (12 locales)
- **Firebase**: always `talkmeapp-e696c` (shared with StarChat)
- **Backends**: StarChat directly for business CRUD, mrcall-agent for AI/chat only
- **Environments**: `.env.development`, `.env.test`, `.env.beta`, `.env.production`
- **Key env vars**: `VUE_APP_STARCHAT_URL`, `VUE_APP_ZYLCH_URL`, `VUE_APP_MRZ_DOMAIN`
- **Dev**: `npm run serve` (:8080)

Cross-repo facts (architecture spanning repos, incident log, operator access)
live in `~/hb/docs/`, not here.
