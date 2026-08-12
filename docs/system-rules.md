# System Rules

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | Vue 3 | 3.4.21 |
| UI Library | PrimeVue | 4.2.5 |
| UI Layout | PrimeFlex | 3.3.1 |
| State Management | Vuex | 4.1.0 |
| Routing | Vue Router | 4.3.0 |
| Authentication | Firebase | 11.3.0 |
| HTTP Client | Axios | 1.11.0 |
| i18n | vue-i18n | 11.1.10 |
| Build (prod) | Vue CLI / Webpack 5 | 5.0.8 / 5.97.1 |
| Build (dev) | Vite | 6.3.4 |
| CSS | Less | 4.2.1 |
| Forms | Vuelidate | 2.0.3 |
| Persistence | vuex-persist + secure-ls | 3.1.3 / 2.0.0 |
| Payments | Stripe (via StarChat proxy) | — |
| Analytics | vue-gtag (GA4) + GTM + Clarity | 2.0.1 |
| E2E Testing | Playwright | 1.58.2 |
| Node | >= 18.0.0 | — |
| npm | >= 8.0.0 | — |

## Coding Standards

### Component Patterns
- Vue 3 with mixed Composition API and Options API usage
- Options API is predominant in existing components
- PrimeVue components are globally registered in `main.js` — import and register with `app.component()` when adding new ones
- Component styles use Less preprocessor with scoped styles where applicable

### Naming Conventions
- **Vue files**: PascalCase (`BusinessConfiguration.vue`, `ZylchChat.vue`)
- **Utility modules**: PascalCase (`Business.js`, `BusinessVariables.js`, `OAuth.js`)
- **Store modules**: camelCase (`calendar.js`, `tracking.js`)
- **Translation files**: locale format (`en-US.json`, `it-IT.json`)
- **Route names**: PascalCase matching view names

### State Management
- Vuex root store handles auth, user, business, onboarding, role state
- Feature modules under `store/modules/` for calendar and tracking
- Encrypted persistence via secure-ls — only auth and onboarding data persist to localStorage
- Access store via `this.$store` (Options API) or `import store from '@/store'` (external)

### API Communication
- All API calls use Axios with Firebase ID token
- Token passed as `Authorization: Bearer <token>` or custom `auth` header
- StarChat endpoint pattern: `/mrcall/v1/talkmeapp0/crm/*`
- Zylch endpoint pattern: `/api/chat/*` and `/api/mrcall/*`
- 401 responses trigger automatic token refresh via Axios interceptor

### Error Handling
- Axios interceptor queues requests during token refresh
- Auth failures trigger automatic logout after refresh failure
- API errors bubble up to components for user-facing messages

### Internationalization
- 12 supported languages: en-US, it-IT, es-ES, fr-FR, de-DE, nl-NL, sv-SE, da-DK, nb-NO, fi-FI, et-EE, el-GR
- Use `$t('key')` in templates, `i18n.global.t('key')` in scripts
- Default locale: en-US with fallback
- All user-facing strings must be in translation files

## Dependency Rules

- **Components** (`components/`) → may import from `utils/`, `store/`, `firebase/`, `i18n/`
- **Views** (`views/`) → may import from `components/`, `utils/`, `store/`, `firebase/`, `i18n/`
- **Utils** (`utils/`) → may import from `firebase/`, `store/` — must NOT import from `components/` or `views/`
- **Store** (`store/`) → may import from `firebase/` — must NOT import from `components/`, `views/`, or `utils/`
- **Router** (`router/`) → may import from `store/`, `firebase/`, `views/`
- **Firebase** (`firebase/`) → standalone, imports only from `config/` and external packages

## Imperative Rules

- Never store secrets or API keys in frontend code
- Always use Firebase ID tokens for authenticated API calls — never roll custom auth
- Always register new PrimeVue components globally in `main.js`
- Never bypass the Axios interceptor for authenticated requests — use the configured Axios instance
- Environment-specific values go in `.env.*` files, never hardcoded
- Business variable defaults must preserve existing values unless mandatory and empty
- Email verification is enforced for email/password users (Google OAuth users skip this)
- All new user-facing strings must have translations in all 12 locale files
