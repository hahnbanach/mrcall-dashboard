# Architecture

## System Map

```
Browser
  │
  ▼
Vue 3 SPA (App.vue)
  │
  ├── Vue Router ─── Auth Guard (requiresAuth, role check, email verification)
  │                      │
  │                      ▼
  │                 Views (56) / Components (49)
  │                      │
  │                      ▼
  │                 Vuex Store (encrypted persistence via secure-ls)
  │                      │
  │         ┌────────────┼────────────────┐
  │         ▼            ▼                ▼
  │   StarChat API   Zylch API     Firebase Auth
  │   (business,     (AI chat,     (JWT tokens,
  │    contacts,      training,     user mgmt)
  │    variables,     sessions)
  │    conversations,
  │    Stripe proxy)
  │
  ├── Analytics: GA4 + GTM + Clarity
  └── UTM Tracking (persisted to localStorage)
```

## Module Responsibilities

### Views (`src/views/`) — 57 files
Route-level components organized by domain:
- `sign/` — Authentication (Signin, Signup, MagicLink)
- `business/` — Business configuration (BusinessConfiguration)
- `onboarding/` — 3-step onboarding wizard (Language → NamePhone → SearchBusiness → AssistantCreated → MakeATestCall)
- `activation/` — Post-onboarding activation flow (ActivateAssistant)
- `admin/` — Admin management (ProvisionReseller, ResellerDetail, ResellerManagement, UserRoleManagement)
- `reseller/` — Reseller features (InvitationCodes, ResellerProfile)
- `oauth/` — OAuth consent flow
- Root views: Account, Analytics, Businesses, Contacts, Conversations, ConfigureAI, Home, Payment, Plan, etc.

### Components (`src/components/`) — 49 files
Reusable UI building blocks:
- `admin/` — ProvisionReseller, ResellerDetail, ResellerList, UserRoleManagement
- `reseller/` — InvitationCodes, OwnerSelector, ResellerDashboard, ResellerProfileView
- `templates/` — Sub-templates for business, sign, onboarding, support
- `webcall/` — DirectVoiceButton, TextChatWidget, WebcallButton
- `widgets/` — Variable editors (MultiselectVariable, TemplatedVariable, TupleVariable, TimeSlotsEditor, FetchWebData)
- Root: Navbar, Businesses, Conversations, Contacts, Analytics, ZylchChat, Plans, Subscription, etc.

### Utilities (`src/utils/`) — 14 modules
API clients and business logic:
- `Business.js` — Business CRUD, variable defaults, type handling
- `BusinessVariables.js` — Variable visibility, dependency resolution, modifiability
- `Zylch.js` — Zylch AI API client (chat, training, sessions)
- `Analytics.js` — Analytics API client
- `Admin.js` — Admin API endpoints
- `Reseller.js` — Reseller API endpoints
- `Contact.js` — Contact management API
- `Conversation.js` — Conversation utilities
- `OAuth.js` — Google Calendar OAuth helpers
- `PKCE.js` — PKCE flow for OAuth 2.0
- `Stripe.js` — Stripe billing integration
- `UtmTracking.js` — UTM parameter tracking
- `PhoneOperators.js` — Phone operator data
- `webcodecs-opus.js` — Audio codec for webcall

### State (`src/store/`)
- `index.js` — Root store: user auth, selected business, onboarding data, role, reseller state
- `modules/calendar.js` — Google Calendar connection state
- `modules/tracking.js` — UTM parameters and referral code tracking

### Firebase (`src/firebase/`)
- `config.js` — Firebase app initialization (indexedDB + browser persistence)
- `authUtils.js` — Auth state listener, proactive token refresh (50-min interval), cross-domain cookie
- `axiosConfig.js` — Axios 401 interceptor, request queue during token refresh

### Router (`src/router/`)
- `index.js` — 76 route definitions with auth guards, role-based access control

### i18n (`src/i18n/`)
- `index.js` — i18n configuration
- `translation.js` — Translation utilities
- `locales/` — 12 JSON translation files

## Data Flow

### Authenticated API Request
```
User Action → Component → Axios Request
                             │
                             ├── Header: Authorization: Bearer <Firebase JWT>
                             │
                             ▼
                         StarChat / Zylch API
                             │
                         ┌───┴───┐
                         │ 401?  │──No──→ Response to Component
                         └───┬───┘
                             │ Yes
                             ▼
                    axiosConfig.js interceptor
                    → Refresh Firebase token
                    → Queue concurrent requests
                    → Retry all queued requests
                    → If refresh fails → logout
```

### Business Configuration Flow
```
BusinessVariables.js (schema) → Business.js (CRUD + defaults)
         │                              │
         ▼                              ▼
Variable visibility/dependency    StarChat API
rules resolve at render time      (persist to backend)
         │
         ▼
BusinessConfiguration.vue renders form fields
by type: string, text, number, boolean, json,
enum, multiselect, tuples, verbatim, templated
```

### Per-Business Credits Tile (`Businesses.vue`)

Each business card shows a "⚡ Crediti residui ⓘ NNN" line in the
info-grid. `NNN` is the raw `CALLCREDIT` resource count read directly
from StarChat by the same `fetchBusinessResources(businessId, …, 'CALLCREDIT')`
call that already populates the SMS pill — **no proxy middleman**, no
mrcall-agent endpoint involved (the desktop's `/api/desktop/llm/balance`
endpoint is unused by the dashboard). The tooltip on ⓘ explains
consumption: a phone call burns ~N credits/minute (per-template
`CALLCREDIT_FACTOR`); configurator chat and MrCall Desktop burn in
proportion to LLM tokens consumed. Topup is the existing `Plan.vue`
route at `/plan`. See `CLAUDE.md` "MrCall AI credits tile" for keys and
helper details.

### Onboarding Flow (3-Step "Try Before You Buy")
```
OnboardingLanguage (1/3) → OnboardingNamePhone (1/3) → OnboardingSearchBusiness (2/3)
→ OnboardingAssistantCreated (3/3) → OnboardingMakeATestCall (post-onboarding)

Activation (post-trial):
BusinessConfiguration "Attiva MrCall" CTA → ActivateAssistant → OnboardingChoosePlan
  (passes ?multilingual=true when STT_SELECTION indicates multilingual)

Legacy steps still routed but not part of primary flow:
OnboardingChooseDevice, OnboardingThisOrOtherDevice, OnboardingForwarding*,
OnboardingSwitchboardConfiguration, OnboardingNotificationPreview, OnboardingPreBookAppointment

State persisted in Vuex `onboardingData` across steps.
BusinessId passed as query param (?id=) for resilience against Vuex loss.
```

## Infrastructure

### Deployment
- **Storage**: Scaleway Object Storage (S3-compatible, `s3.fr-par.scw.cloud`)
- **CDN/HTTPS**: Scaleway Edge Services with Let's Encrypt TLS
- **SPA routing**: Bucket website hosting with error document = `index.html`
- **CI/CD**: GitHub Actions, one tag per environment (`vX.Y.Z-test`, `-beta`, `-production`)

| Environment | Branch | Bucket | Domain |
|-------------|--------|--------|--------|
| Test | `test-env` | `mrcall-dashboard-test` | `dashboard-test.mrcall.ai` |
| Beta | `beta-env` | `mrcall-dashboard-beta` | `dashboard-beta.mrcall.ai` |
| Production | `production-env` | `mrcall-dashboard` | `dashboard.mrcall.ai` |

### External Services
- **StarChat** — Backend API for business logic, contacts, conversations, Stripe proxy
- **Zylch** — AI backend for conversational assistant configuration and training
- **Firebase** — Authentication. Project `talkmeapp-e696c` in **all three** environments,
  test included: the `mrcall-test-3a669` block in `.env.test` is commented out and dormant.
  (This line previously claimed test used `mrcall-test-3a669`, contradicting `docs/README.md`.)
- **Stripe** — Payment processing (checkout via StarChat, customer portal direct)
- **Google** — OAuth for Calendar integration, Google Sign-In.
  Client, scopes, token storage and verification status: [integration/google-oauth.md](integration/google-oauth.md)

## Cross-Cutting Concerns

### Authentication
- Firebase Auth handles all auth methods (email/password, Google OAuth, magic links, custom tokens)
- Proactive token refresh every 50 minutes (`authUtils.js`)
- Axios interceptor catches 401 and refreshes token with request queue (`axiosConfig.js`)
- Router guard enforces auth + email verification (`router/index.js`)
- Cross-domain cookie (`mrcall_uid`) for shared mrcall.ai domains

### Google authorization

Sign-in, calendar connection and skill authorizations all use the authorization
code flow with PKCE, and all three go through `GoogleAuthFlow` in
`src/utils/OAuth.js`:

```
begin()          mint the PKCE verifier and a state, store both, return the
                 challenge for the authorization URL
   │             user goes to Google and comes back to /callback
consume(state)   check the returned state against the stored one, hand back the
                 verifier, clear both. A mismatch aborts: it is what a callback
                 forged by someone else looks like
exchangeCode()   POST the code and verifier to the backend, which holds the
                 client secret and talks to Google
```

The exchange is server side because Google's web client type requires a client
secret at the token endpoint, and anything the browser holds is public: vue-cli
inlines every `VUE_APP_*` value into the bundle whether the code reads it or not.
The backend endpoint is `POST /mrcall/v1/{realm}/oauth/google/token`.

### Role-Based Access
- Three roles: `owner`, `reseller`, `admin`
- Routes use `meta.requiresRole` for access control
- Admin routes: reseller management, user role management
- Reseller routes: dashboard, invitation codes, profile

### Analytics & Tracking
- Google Analytics 4 via vue-gtag (ID: `G-2C4EZMZHVF`)
- Google Tag Manager (ID: `GTM-MW4TX4N`)
- Microsoft Clarity for session recording
- UTM parameter capture and persistence via `UtmTracking.js` and `tracking` store module

### Security
- Encrypted localStorage via secure-ls for Vuex persistence
- Firebase JWT validation on all API calls
- PKCE for OAuth flows
- Email verification enforcement for email/password users
- No secrets in frontend code. Note that environment variables are not a hiding
  place: vue-cli inlines every `VUE_APP_*` value into the public bundle whether
  the code reads it or not, so anything that must stay private belongs on the
  backend, not in a variable
