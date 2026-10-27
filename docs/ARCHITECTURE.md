# Architecture

## System Map

```
Browser
  │
  ▼
Vue 3 SPA (App.vue)
  │
  ├── Vue Router ─── Auth Guard (session unless meta.public, role check, email verification)
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
- `widgets/restaurant/` — the restaurant page's panels and editors; `widgets/skills/` — the skill card and its field widgets
- Root: Navbar, Businesses, Conversations, Contacts, Analytics, ZylchChat, Plans, Subscription, etc.

### Utilities (`src/utils/`)
API clients and business logic:
- `Business.js` — Business CRUD, variable defaults, type handling
- `BusinessVariables.js` — Variable visibility, dependency resolution, modifiability
- `Zylch.js` — Zylch AI API client (chat, training, sessions)
- `Analytics.js` — Analytics API client
- `CallInsights.js` — what calls said: the value table of a call's four dimensions (`insightRows`:
  `resolution` and `message` are the assistant's own assessment, marked as such; `booked` and
  `transferred` are recorded facts, `transferred` absent on a version-2 call is "not known"; `forwarded`, a
  request passed to the business, is one entry of the resolution list), the outcome lines over the calls where
  the caller asked something (`outcomeShare`, from StarChat's `outcome` and `callsWithRequest`), and the clients
  for StarChat's outcomes, quality, assistants, topics, reports (page, one report, overlap, delete), insights jobs
  (estimate, create, read, list, cancel), callers' requests by category (`view=categories`, a category's
  businesses, dismiss and restore) and configuration-suggestions routes; a 404 resolves to `null` (absent
  section), a 503 to `{unavailable: true}`, a refusal's closed code is read by `refusalOf`. `serverPage` is the
  one mechanism for a list StarChat pages (offset and size, the first page's `asOf` sent back on every other page,
  the sort and its direction, and the states `loading`, `ok`, `absent`, `unavailable`, `error`);
  `businessLabel` shows a business by name, its id only when StarChat has none; `business` reads a business's
  name, zone, owner and plan; `searchBusinesses` finds businesses by company name; `ownerName` names the owner a
  filter is set on (by the contact of its first business: StarChat's admin user record carries only the role)
- `InsightsReports.js` — the reports' and jobs' rules applied to StarChat's answers: a period's days in the
  business's zone, its last day included; the periods a request offers, ending at the last midnight there; the
  label of every report and job state; a recompute's progress; who asked, by the role StarChat recorded (`requesterRole`), never by an id; the coverage banner's
  threshold. Pure, pinned by `tests/unit/insightsReports.spec.js`
- `KnowledgeBase.js` — "Add the answer": one question/answer pair added to the business's knowledge base
  (`?section=__KNOWLEDGE_BASE__&draftQuestion=`), unsaved until the person saves
- `Admin.js` — Admin API endpoints
- `Reseller.js` — Reseller API endpoints
- `Contact.js` — Contact management API
- `Conversation.js` — Conversation utilities
- `OAuth.js` — Google authorization flow (PKCE, state, code exchange), sign-in and provider-specific Calendar/Sheets chat scopes, and single-use skill authorization context
- `SheetsConnection.js` — verified Sheets consent intent bound to owner/business/session/target; resumes read/review only, never Save
- `AgentSkills.js` — skill catalogue, saved configuration and scoped effective availability
- `Restaurant.js` — StarChat restaurant book client and answer shapes; `RestaurantModel.js` — what the restaurant page computes from them
- `PKCE.js` — PKCE flow for OAuth 2.0
- `Stripe.js` — Stripe billing integration
- `UtmTracking.js` — UTM parameter tracking
- `PhoneOperators.js` — Phone operator data
- `VoiceEncoding.js` — Browser capability check and preferred direct-voice encoding

### State (`src/store/`)
- `index.js` — Root store: user auth, selected business, onboarding data, role, reseller state
- `modules/tracking.js` — UTM parameters and referral code tracking

### Firebase (`src/firebase/`)
- `config.js` — Firebase app initialization (indexedDB + browser persistence)
- `authUtils.js` — Auth state listener, proactive token refresh (50-min interval), cross-domain cookie
- `axiosConfig.js` — Axios 401 interceptor, the only owner of a 401: token refresh with request queue, end of session, `isSessionEnded(error)`
- `session.js` — `isSessionEnded(error)` with no imports, re-exported by `axiosConfig.js`

### Router (`src/router/`)
- `index.js` — Route definitions and the guard. Every route needs a session unless it declares `meta: { public: true }`; `tests/unit/publicRoutes.spec.js` lists the public ones, read from the source by `publicPaths()` in `scripts/static-routes.js`. Role-based access control via `meta.requiresRole`

### i18n (`src/i18n/`)
- `index.js` — i18n configuration
- `translation.js` — Translation utilities
- `locales/` — 12 JSON translation files

## Data Flow

### Authenticated Axios request

This flow covers Axios requests. AI chat SSE (native fetch) and the WebSocket
connections (Whatsappweb, the Aladdin configurator, TestChat, the webcall text
chat and voice button) do not receive the interceptor; see
[the integration contract](integration/zylch-integration.md).

The interceptor considers a 401 only on a request sent to `VUE_APP_STARCHAT_URL` or
`VUE_APP_ZYLCH_URL` that carried a token header (`auth` or `Authorization: Bearer`).
Any other 401 passes through unchanged: a StarChat call made without a token (OAuth
consent, code exchange) or Google refusing its own token says nothing about the
session. Components do not handle 401: for an error where `isSessionEnded(error)` is
true they show nothing and navigate nowhere.

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
                    → Retry answered 401, refresh failed, or no user
                      → end the session (once until somebody signs in):
                        logout, then /signin?redirect=<page>&session_expired=1
                      → reject with error.sessionEnded = true
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
The credit comes from StarChat's `.../crm/business/resources/balance`
(`{available, debt, net}`, through `fetchCreditBalance` in `src/utils/CreditBalance.js`).
The card shows `net`, which is negative while the business is in debt, together with a
debt notice. A StarChat without that endpoint answers 404, and the balance falls back to
`.../resources/count` with no debt. An answer that is not a valid balance leaves the
credit unknown: the card shows a dash and no credit pill, never zero. `CALL` and `SMS`
are fetched from `.../resources/count`. The tooltip uses `mrcallCredits.title` and `mrcallCredits.tooltip`;
`creditTooltipFactor(business)` parses `CALLCREDIT_FACTOR` by template with a
fallback of 25. All 12 locale files contain these keys. The `/plan` route renders
`src/views/Plan.vue` for plan and payment selection.

### Call insights: what calls said

StarChat records, for every managed call, what it was about and what it left open (topics, a
resolution and a message judged by the assistant, whether it booked and was transferred, the
questions the assistant could not answer, three quality checks); the dashboard's one value table
for the four dimensions lives in `src/utils/CallInsights.js`.

- **The call's panel** (`CallDetailsPanel.vue`, in `Conversations.vue`'s list and its deep-linked
  opened call): after the summary, the topics as tags, the four dimensions under the value table, the
  unanswered questions with their reason and suggestion, the checks that fired. A call from before
  the feature draws with none of this.
- **The list's filters** (`Conversations.vue`): resolution and message `Dropdown`s (marked
  "Assessed by the assistant"), a booked `Dropdown`, and "transferred" and "unanswered questions"
  `ToggleButton`s, all folded into the
  one `searchBody(extra)` the list, its poll, both exports and the two bulk actions all build from.
- **The analytics pages** (`src/components/analytics/`; StarChat's brief docs/briefs/2026-10-24-insights-reports-ux.md
  for the reports, jobs and requests). `Analytics.vue` and `AnalyticsAdmin.vue` fetch the outcomes, topics and
  quality and pass them to presentational sections (`CallOutcomes.vue`, `CallTopics.vue`, `CallQuality.vue`);
  every server-paged list owns its `CallInsights.serverPage` and draws through `PagedTable.vue` (a real table,
  sortable headers with `aria-sort`, page numbers and "1–10 of N", each row a card under 640 pixels), and every
  loading, empty, unavailable and error state is `InsightsState.vue`. Both pages carry `AnalyticsFilterBar.vue`,
  the filters in force each undone where it shows; a business is shown by name wherever an answer names it.
  "How the calls went" shows the outcome of the calls where the caller asked something in four lines adding up to
  their base (resolved in the call; passed to the business, split by the message taken; passed to a person; not
  resolved), from StarChat's `outcome` and `callsWithRequest`, with `caller_left` and `spam_wrong_number` beside
  it in neutral colours, the message, booked and transferred, and the calls without a conversation by reason.
  No section shows a cost, a credit amount or a token count: StarChat answers none.
  - `Analytics.vue` with a business (`?id=`, any role) has three tabs, each with its address (`?tab=`):
    Overview (the period's sections, a coverage banner when at least 10 managed calls and a tenth of them lack
    the analysis, with "Analyse them now", and a card on the callers who never spoke linking to the greeting);
    Reports (`ReportsTab.vue`: the schedule panel with the cadence, the next report and a report held back for
    credit, "Request a report" and "Prepare now", the report jobs asked recently, and the history paged on the
    server with its inclusive days in the business's zone, type, version, state, calls over the calls managed,
    who asked and when, filtered by state and type, with Regenerate, an admin's re-run of a written-off period and
    delete); Processing (`JobsTab.vue`: the jobs, their state and progress, who asked, the report written and a
    cancel while open). A FREE business's owner is offered the plan instead of paid work.
  - `/analytics/report?id=&start=&requestId=` (`views/AnalyticsReport.vue`, `CallReportDetail.vue`): one report, its version,
    its base and the calls left out (the analytics of its days), a note when more calls of its days were analysed
    since, its themes, the questions left unanswered by reason with example calls (linked for the owner only) and
    "Add the answer", its suggestions (`mrcall_config` for an admin only), and the quality gaps beside the period
    before. A link of before (`/analytics?id=&report=`) opens it.
  - `InsightsRequestDialog.vue`: a report for a period, a regeneration, a recompute, "Prepare now" and a re-run,
    one dialog: the period with the overlap choices, a hidden estimate, a confirmation without amount (an admin
    may put the work at MrCall's cost), the job under one request key, its progress and end, and each refusal
    with its own copy and offers (automatic top-up offered only when StarChat's estimate says it is not effective, `topUpEffective`; an admin refused for credit can run the work at MrCall's cost).
  - `Analytics.vue` with no business, role `reseller` (its scope page): outcomes and quality over its scope (the
    `OwnerSelector` narrows it to one owner), the topics section saying to choose a business,
    `AssistantsToReview.vue` and `RequestCategories.vue`, both following the period and owner.
  - `AnalyticsAdmin.vue`: the same sections reacting to its own filters (the business chosen by company name,
    `BusinessAutocomplete.vue`), topics only with a business chosen, "Assistants to review" (paged, sorted on
    the server, searched by name, "Unresolved" against the period before in points, MrCall's configuration suggestions for an admin, each account's health in words), "Callers' requests" (`RequestCategories.vue`:
    one row per category with its status, numbers, histogram and freshness, its businesses on demand, archive and
    restore for an admin, the examples hidden from a row shown and restored with "Show archived"), and MrCall's own configuration suggestions (`ConfigSuggestions.vue`, admin only, the
    one section that follows no filter, which the bar says while it is on screen).
  - Both pages establish the role on mount (the same business search that already sets it,
    `Business.js`'s `checkUserHasBusinesses`) before choosing which sections to show; the server remains the
    actual gate (a 404 hides a section with no toast, a 503 shows a short note).

### Restaurant bookings (`RestaurantBook.vue`)

A business with an instance of the restaurant skill (`skill_restaurant_booking` or `restaurant_booking`, the two
names StarChat reads it under) in the `during` phase, its page on, gets a "Restaurant bookings" entry in the configuration menu: the synthetic section `__RESTAURANT_BOOKING__`, built by the page rather
than declared by the template, as `__DATA_RETENTION__` is. The page (tabs Evening, Room and tables, Hours and rules)
reads and writes the book through StarChat's `/apidomain/restaurant/{businessId}` and edits only the restaurant's own
settings of the skill instance (`x-audience: page`); the skill form edits the rest. Every request and the
translation of every answer live in `src/utils/Restaurant.js`. The integration guide is
[integration/restaurant-booking.md](integration/restaurant-booking.md).

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
- **Google** — Google Sign-In, and Google Calendar authorization per skill (for a business, under the skill's grant name or the business's shared one), stored by StarChat.
  The client flow and scope constraints are implemented in `src/utils/OAuth.js`.

The chat reuses business-wide Google Calendar consent. Generic proposals use
BusinessSkillConnection; the complete five-skill booking group uses BookingCalendarConnection
with explicit activation intent, a calendar choice by name and backend-owned scoped Save.
Its sessionStorage intent binds the exact verified OAuth state and is consumed once, so
navigation alone never activates. There is no calendar connection on Account or in
`__SEND_DATA__`. See [Google OAuth](integration/google-oauth.md#business-wide-consent-from-the-chat)
and the [booking continuation](integration/zylch-integration.md#five-skill-booking-connection).

The confirmed skill refresh connects ConfigureAIPanel's confirmed
saved-phase notices to BusinessConfiguration's guarded saved-configuration read.
Only clean affected phase projections change; ordinary edits and dirty manual
skill phases remain local. Outstanding saved phases coalesce across overlapping
reads, including failures, with owner/business/generation protection. Warnings
separate page refresh failure or retained edits from the confirmed Save outcome.

## Cross-Cutting Concerns

### Authentication
- Firebase Auth handles all auth methods (email/password, Google OAuth, magic links, custom tokens)
- Proactive token refresh every 50 minutes (`authUtils.js`)
- Axios interceptor catches 401 and refreshes token with request queue, and is the only code that ends a session on a 401 (`axiosConfig.js`)
- Router guard asks for a session on every route not declared public, and enforces email verification (`router/index.js`)
- Cross-domain cookie (`mrcall_uid`) for shared mrcall.ai domains

### Google authorization

Sign-in, the chat skill handoff and the manual skill editor all use the
authorization code flow with PKCE, and all three go through `GoogleAuthFlow` in
`src/utils/OAuth.js` (there is no account-level calendar connection; Google
Calendar is authorized per skill only):

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

Skill authorization binds owner, business, supported scopes and a safe local
return location to that state. Saved-instance authorization also binds the exact
saved grant and phase/instance. The business target uses an unnamed business
grant and excludes phase, instance and operation IDs. The callback consumes and
verifies either context before connecting; see the
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
