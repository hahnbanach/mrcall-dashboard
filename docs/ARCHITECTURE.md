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
  │                 Views / Components
  │                      │
  │                      ▼
  │                 Vuex Store (persistence via secure-ls)
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

### Views (`src/views/`)
Route-level components organized by domain:
- `sign/` — Authentication (Signin, Signup, MagicLink)
- `business/` — Business configuration (BusinessConfiguration)
- `onboarding/` — 3-step onboarding wizard (Language → NamePhone → SearchBusiness → AssistantCreated → WizardConfiguration)
- `activation/` — Post-onboarding activation flow (ActivateAssistant)
- `admin/` — Admin management (ProvisionReseller, ResellerDetail, ResellerManagement, UserRoleManagement)
- `reseller/` — Reseller features (InvitationCodes, ResellerProfile)
- `oauth/` — OAuth consent flow
- Root views: Account, Analytics, Businesses, Contacts, Conversations, Zylch, Home, Payment, Plan, etc.

### Components (`src/components/`)
Reusable UI building blocks:
- `admin/` — ProvisionReseller, ResellerDetail, ResellerList, UserRoleManagement
- `reseller/` — InvitationCodes, OwnerSelector, ResellerDashboard, ResellerProfileView
- `templates/` — Sub-templates for business, sign, onboarding, support
- `webcall/` — DirectVoiceButton, TextChatWidget, WebcallButton
- `widgets/` — Variable editors (MultiselectVariable, TemplatedVariable, TupleVariable, TimeSlotsEditor, FetchWebData)
- Root: Navbar, Businesses, Conversations, Contacts, Analytics, ZylchChat, Plans, Subscription, etc.

### Utilities (`src/utils/`)
API clients and business logic:
- `Business.js` — Business CRUD, variable defaults, type handling
- `BusinessVariables.js` — Variable visibility, dependency resolution, modifiability
- `Zylch.js` — Zylch AI API client (chat, training, sessions)
- `Analytics.js` — Analytics API client
- `Admin.js` — Admin API endpoints
- `Reseller.js` — Reseller API endpoints
- `Contact.js` — Contact management API
- `Conversation.js` — Conversation utilities
- `OAuth.js` — Google Calendar OAuth helpers and single-use skill authorization context
- `AgentSkills.js` — skill catalogue, saved configuration and scoped effective availability
- `PKCE.js` — PKCE flow for OAuth 2.0
- `Stripe.js` — Stripe billing integration
- `UtmTracking.js` — UTM parameter tracking
- `PhoneOperators.js` — Phone operator data
- `VoiceEncoding.js` — Browser capability check and preferred direct-voice encoding

### State (`src/store/`)
- `index.js` — Root store: user auth, selected business, onboarding data, role, reseller state
- `modules/calendar.js` — Google Calendar connection state
- `modules/tracking.js` — UTM parameters and referral code tracking

### Firebase (`src/firebase/`)
- `config.js` — Firebase app initialization (indexedDB + browser persistence)
- `authUtils.js` — Auth state listener, proactive token refresh (50-min interval), cross-domain cookie
- `axiosConfig.js` — Axios 401 interceptor, request queue during token refresh

### Router (`src/router/`)
- `index.js` — Route definitions with auth guards, role-based access control

### i18n (`src/i18n/`)
- `index.js` — i18n configuration
- `translation.js` — Translation utilities
- `locales/` — 12 JSON translation files

## Data Flow

### Authenticated Axios request

This flow covers Axios requests. AI chat SSE uses native fetch and does not
receive the interceptor; see [the integration contract](integration/zylch-integration.md).

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

Each business card displays the `CALLCREDIT` balance as euros using
`creditsToEuro`: credits divided by 100, formatted as EUR for the current locale.
`fetchBusinessResources` posts directly to StarChat's
`/mrcall/v1/mrcall0/crm/business/resources/count`; it separately fetches
`CALLCREDIT`, `CALL`, and `SMS`. The dashboard does not call the desktop balance
endpoint. The tooltip uses `mrcallCredits.title` and `mrcallCredits.tooltip`;
`creditTooltipFactor(business)` parses `CALLCREDIT_FACTOR` by template with a
fallback of 25. All 12 locale files contain these keys. The `/plan` route renders
`src/views/Plan.vue` for plan and payment selection.

### Onboarding and plan selection
```
OnboardingLanguage (1/3) → OnboardingNamePhone (1/3) → OnboardingSearchBusiness (2/3)
→ OnboardingAssistantCreated (3/3) → WizardConfiguration
  (or BusinessConfiguration when the wizard is already completed for this business)

Plan selection:
BusinessConfiguration ActionPanel → OnboardingChoosePlan
  (passes multilingual=true for MULTILINGUAL_ENABLED,
   booking=true for START_BOOKING_PROCESS)

Other routed steps include OnboardingMakeATestCall, ActivateAssistant,
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

Environment tags, buckets, domains, build settings and promotion rules are
specified in [development.md](development.md#environment-routing).

### External Services
- **StarChat** — Backend API for business logic, contacts, conversations, Stripe proxy
- **Zylch** — AI backend for conversational assistant configuration and training
- **Firebase** — Authentication. Project `talkmeapp-e696c` in **all three** environments,
  as required by the shared authentication integration; actual local and deployed
  environment configuration must be checked separately.
- **Stripe** — Payment checkout through the StarChat Stripe proxy
- **Google** — OAuth for Calendar integration, Google Sign-In.
  The client flow and scope constraints are implemented in `src/utils/OAuth.js`.

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

Skill authorization additionally binds owner, business, exact saved grant,
phase/instance, supported scopes and a safe local return location to that state.
The callback consumes and verifies the context before connecting; see the
[skill authorization contract](integration/zylch-integration.md#skill-authorization-handoff).

The dashboard sends the code and verifier to
`POST /mrcall/v1/mrcall0/oauth/google/token`. Token exchange and client-secret
handling belong to StarChat. Browser environment values are public build
configuration.

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
- Vuex persistence uses secure-ls storage; encoding defaults require installed-dependency verification.
- Authenticated clients send Firebase tokens; server-side validation belongs to the backend.
- AI chat SSE uses native fetch and bypasses the Axios interceptor; see the integration contract.
- PKCE for OAuth flows
- Email verification enforcement for email/password users
- No secrets in frontend code. Note that environment variables are not a hiding
  place: vue-cli inlines every `VUE_APP_*` value into the public bundle whether
  the code reads it or not, so anything that must stay private belongs on the
  backend, not in a variable
