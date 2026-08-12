# Zylch AI Integration

## Overview

The MrCall Dashboard integrates with Zylch AI to provide AI-powered assistant configuration. Users can configure their MrCall phone assistant (prompts, greetings, objectives, questions) through a conversational chat interface, without needing CLI access or technical knowledge.

Zylch handles:
- Natural language understanding of configuration requests
- Reading current assistant configuration from StarChat API
- Generating and applying prompt modifications while preserving variables
- Training personalized configuration agents from business data

## Architecture

```
┌─────────────────────────┐
│   MrCall Dashboard      │
│   (Vue.js)              │
│                         │
│  ConfigureAI.vue        │
│    └─ ZylchChat.vue     │
│         └─ Zylch.js     │──── Firebase JWT ────┐
└─────────────────────────┘                       │
                                                  ▼
                                    ┌──────────────────────┐
                                    │  Zylch Backend        │
                                    │  (FastAPI)            │
                                    │                       │
                                    │  POST /api/chat/msg   │
                                    │  GET  /api/chat/hist  │
                                    └──────────┬───────────┘
                                               │
                                    Firebase JWT (auth header)
                                               │
                                               ▼
                                    ┌──────────────────────┐
                                    │  StarChat API         │
                                    │  (MrCall backend)     │
                                    │                       │
                                    │  GET/POST /crm/...    │
                                    │  Business config      │
                                    │  Variable schema      │
                                    └──────────────────────┘
```

**Key**: The Firebase JWT flows end-to-end. Dashboard → Zylch → StarChat. No separate OAuth needed.

## Authentication

### Shared Firebase Project

Both the MrCall Dashboard and Zylch use Firebase project `talkmeapp-e696c`. This means:
- A user logged into the dashboard already has a valid Firebase JWT
- Zylch accepts this JWT directly (same Firebase project)
- StarChat also accepts this JWT (same Firebase project)
- No `/connect mrcall` or OAuth flow required

### HTTP Headers

Every request from the dashboard includes:

| Header | Value | Purpose |
|--------|-------|---------|
| `Authorization` | `Bearer <firebase_jwt>` | Authentication |
| `Content-Type` | `application/json; charset=UTF-8` | Request format |
| `X-Client-Source` | `mrcall_dashboard` | Identifies dashboard origin (enables sandbox mode) |

The `X-Client-Source` header is sent only on `sendMessage` requests. It tells Zylch to activate sandbox mode, restricting the user to MrCall-only commands.

## API Client (`src/utils/Zylch.js`)

### Configuration

Base URL is set via environment variable:
```
VUE_APP_ZYLCH_URL=http://localhost:8000    # Development
VUE_APP_ZYLCH_URL=https://api.zylch.ai     # Production
```

### Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `sendMessage(message, session_id?)` | `POST /api/chat/message` | Send user message, get AI response |
| `getHistory(session_id?)` | `GET /api/chat/history` | Load conversation history |
| `listSessions()` | `GET /api/chat/sessions` | List all chat sessions |
| `deleteSession(sessionId)` | `DELETE /api/chat/session/{sessionId}` | Delete a session |
| `healthCheck()` | `GET /api/chat/health` | Check Zylch service status |

### Not used by the dashboard

The mrcall-agent backend exposes `GET /api/desktop/llm/balance` for the
**MrCall Desktop sidecar only**. The dashboard does **not** call it.
The "⚡ Crediti residui" tile in `Businesses.vue` reads the
`CALLCREDIT` count directly from StarChat (same fetch as the existing
CALLCREDIT minutes / SMS pills) — no proxy middleman. The
`fetchLLMBalance` helper that briefly lived in `Zylch.js` was removed
on `feat/llmtokens-billing` (tip `f2bdb0d`).

### Request Format (`sendMessage`)

```json
{
  "message": "/mrcall open abc123-def456",
  "session_id": "optional-session-id"
}
```

### Response Format

```json
{
  "success": true,
  "response": "Markdown-formatted AI response...",
  "session_id": "session-uuid",
  "timestamp": "2026-02-13T10:30:00Z"
}
```

## Pages & Components

### `ConfigureAI.vue`

Two-column layout page for AI-powered assistant configuration.

**Left sidebar**: Quick command buttons:
- `/mrcall open` — Open business configuration
- `/mrcall variables` — List configurable variables
- `/mrcall show` — Show current configuration
- `/help` — Show available commands

**Right area**: `ZylchChat` component (chat interface).

**Auto-initialization**: On mount, extracts `businessId` from route query params and silently sends `/mrcall open <businessId>` to Zylch. The user sees the welcome response but not the command itself.

**Route**: `/configure-ai?businessId=<id>` (navigated from BusinessConfiguration page)

### `ZylchChat.vue`

Reusable chat component with:

- **Message display**: Renders markdown-like formatting (bold, italic, code, line breaks, emoji styling)
- **Silent send**: `sendSilentMessage(text)` method sends a command without displaying it in chat (used for auto-init)
- **Session management**: Persists `session_id` across messages; loads history on mount
- **Typing indicator**: Animated dots while waiting for Zylch response
- **Error handling**: Auth expiry banner (401), general error banner, message restoration on failure
- **Auto-scroll**: Scrolls to bottom on load and after each message

### `Zylch.js`

Thin API client wrapper. All methods:
1. Get current Firebase user and access token
2. Build headers with Bearer auth
3. Make HTTP request to Zylch backend
4. Return parsed JSON response
5. Log errors and re-throw

## User Flow

1. User opens **Business Configuration** page in MrCall Dashboard
2. Clicks **"Configure with AI"** button
3. Dashboard navigates to `/configure-ai?businessId=<id>`
4. `ConfigureAI.vue` mounts:
   - Loads `ZylchChat` component
   - `ZylchChat` loads conversation history
   - `ConfigureAI` sends silent `/mrcall open <businessId>` to Zylch
5. Zylch receives the command:
   - Extracts Firebase token from `Authorization` header
   - Detects `source: mrcall_dashboard` → activates sandbox mode
   - Creates `StarChatClient` with Firebase auth
   - Auto-links business_id for subsequent commands
   - Returns welcome message with assistant details
6. User configures assistant via chat:
   - Types natural language (e.g., "rendi il saluto piu formale")
   - Or uses sidebar commands (e.g., `/mrcall variables`)
7. Zylch processes each request:
   - Reads current config from StarChat
   - Generates modifications via LLM (preserving variables like `%%name=Guest%%`)
   - Applies changes to StarChat
   - Returns formatted response

## Sandbox Mode

Dashboard users operate in a restricted environment. This is enforced **server-side** by Zylch — the client cannot bypass it.

### Allowed Commands

| Command | Purpose |
|---------|---------|
| `/mrcall open <id>` | Enter config mode for an assistant |
| `/mrcall list` | List available assistants |
| `/mrcall variables` | Show configurable variables |
| `/mrcall show` | Show current configuration |
| `/mrcall config <var> <value>` | Set a configuration value |
| `/agent mrcall train` | Generate personalized configuration prompt |
| `/agent mrcall run` | Apply configuration using trained prompt |
| `/agent mrcall show` | Display current agent prompt |
| `/help` | Show available commands (sandbox-specific) |

### Blocked

All other Zylch commands (`/email`, `/calendar`, `/sync`, `/tasks`, `/memory`, `/connect`, etc.) return a friendly error message suggesting the user access the full Zylch app for those features.

Free-form chat (natural language) is routed to the MrCall Orchestrator Agent only when in config mode (after `/mrcall open`).

## Environment Configuration

### Dashboard Environment Variables

```bash
# .env.development
VUE_APP_ZYLCH_URL=http://localhost:8000
VUE_APP_STARCHAT_URL=https://<your-mrcall-backend>

# .env.production
VUE_APP_ZYLCH_URL=https://api.zylch.ai
VUE_APP_STARCHAT_URL=https://api.mrcall.ai
```

### Zylch Backend (`.env.mrcall`)

```bash
# CRITICAL: Must match dashboard's VUE_APP_STARCHAT_URL
MRCALL_BASE_URL=https://<your-mrcall-backend>   # Dev
# MRCALL_BASE_URL=https://api.mrcall.ai             # Prod

# System-level LLM key (users don't need /connect anthropic)
ANTHROPIC_API_KEY=sk-ant-...

# Firebase (same project as dashboard)
FIREBASE_PROJECT_ID=talkmeapp-e696c
```

### URL Alignment Rule

`VUE_APP_STARCHAT_URL` (dashboard) and `MRCALL_BASE_URL` (Zylch) **must point to the same StarChat server**. Business data is server-specific — if the dashboard creates a business on the test server but Zylch queries the production server, the business won't be found.

## Pending Changes & Save Button (added 2026-03-24)

When a user configures something via the chat, changes are **not applied immediately**. Instead:

1. Backend runs the MrCallAgent in `dry_run` mode — validates, generates summary, but skips StarChat calls
2. `pending_changes` array is returned in the API response `metadata`
3. `ZylchChat.vue` emits `pending-changes` event to `ConfigureAI.vue`
4. ConfigureAI accumulates changes in `pendingChanges` reactive array (deduplicates by `variable_name`)
5. **Save button** appears in the left sidebar: "Save changes (N)"
6. On Save: `POST /api/mrcall/apply-changes` with `{business_id, changes: [{variable_name, new_value}]}`
7. On Discard: clears pending changes without calling StarChat

Changes live only in frontend memory — lost on page reload.

### Apply Changes Endpoint

```
POST /api/mrcall/apply-changes
Authorization: Bearer <firebase_jwt>
Content-Type: application/json

{
  "business_id": "738535bd-...",
  "changes": [
    {"variable_name": "INBOUND_WELCOME_MESSAGE_PROMPT", "new_value": "..."},
    {"variable_name": "START_BOOKING_PROCESS", "new_value": "true"}
  ]
}
```

Response: `{"success": true, "applied": 2, "errors": []}`

## Troubleshooting

### "Business not found" / empty business data

**Cause**: URL mismatch between dashboard and Zylch. Dashboard hits `<your-mrcall-backend>` while Zylch hits `api.mrcall.ai` (or vice versa).

**Fix**: Ensure `VUE_APP_STARCHAT_URL` and `MRCALL_BASE_URL` point to the same server.

### 401 Unauthorized

**Cause**: Firebase token expired or invalid.

**Fix**: Refresh the dashboard page (Firebase auto-refreshes the token on reload). If persistent, check that both apps use Firebase project `talkmeapp-e696c`.

### "Command not available"

**Cause**: User tried a Zylch command that's blocked in sandbox mode (e.g., `/sync`, `/email`).

**Expected**: This is by design. Dashboard users can only configure their MrCall assistant. For full Zylch features, they need the standalone Zylch app.

### Chat not loading / empty responses

**Cause**: Zylch backend not running or `VUE_APP_ZYLCH_URL` misconfigured.

**Fix**: Check that Zylch is running at the configured URL. Run `healthCheck()` to verify.

## Training Status Feature

The dashboard includes a training system that lets users train a personalized AI configuration agent from their business data. The Zylch backend stores a **snapshot** of MrCall variable values after each training. By comparing live values with the snapshot, it determines whether retraining is needed.

### Additional API Endpoints (Training)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `getTrainingStatus(user)` | `GET /api/mrcall/training/status` | Get training status (current/stale/untrained/in_progress) |
| `startTraining(user, options)` | `POST /api/mrcall/training/start` | Start background training job |
| `getJobStatus(user, jobId)` | `GET /api/jobs/{jobId}` | Poll background job status |

### Status Values

| Status | Meaning | Button Color | Button Label |
|--------|---------|-------------|--------------|
| `untrained` | Never trained (no snapshot) | Gray | "Train Agent" |
| `current` | All variables match snapshot | Green | "Agent Trained" |
| `stale` | Variables changed since training | Red | "Retrain needed (N changes)" |
| `in_progress` | Training job running | Yellow (spinner) | "Training..." |

### Training UI in BusinessConfiguration.vue

The training button is in the page footer, between "Configure with AI" and "Save":

```
[Configure with AI]   [Training Status Button]   [Save]
```

**Lifecycle**:
1. On page load (`initializePage`), calls `fetchTrainingStatus()`
2. Button shows current status with color coding
3. Click starts training via `handleTrainClick()` → `zylchUtils.startTraining()`
4. Polls job status every 3s via `_startTrainingPoll(jobId)`
5. On completion, refreshes status and shows success/error message
6. Cleanup on `beforeUnmount` stops polling interval

**Key data properties**:
- `trainingStatus` — `'loading'|'untrained'|'current'|'stale'|'in_progress'|'unknown'|null`
- `changedVariablesCount` — number of variables that changed
- `trainingJobId` — active job ID (for polling)
- `trainingPollInterval` — setInterval ID (for cleanup)

**Computed properties**: `trainingIcon`, `trainingLabel`, `trainingButtonClass`, `canTrain`

### Training UI in ConfigureAI.vue

Shows a small training status badge in the sidebar (below help text, above back button):
- Fetches status on mount before the auto-training flow
- Non-interactive (read-only indicator)
- Shows "X variables changed" hint when stale

### Selective Retraining

When training starts:
1. Backend loads snapshot of last-trained variable values
2. Compares with live StarChat values
3. Only retrains features whose variables actually changed
4. Updates snapshot with new values (only for successfully trained features)

This means a change to one variable (e.g., welcome message prompt) only regenerates that one feature's sub-prompt instead of all 8.

### Background Job Polling

Training runs as a background job. The dashboard:
1. Calls `POST /api/mrcall/training/start` → gets `{job_id}`
2. Polls `GET /api/jobs/{job_id}` every 3 seconds
3. Job status transitions: `pending` → `running` → `completed`/`failed`
4. Self-healing: stuck jobs (>10 min) are auto-marked as failed

### Training Error Handling

- **400 (not linked)**: `trainingStatus = null` — hides button (user has no linked business)
- **409 (already running)**: Extracts job ID from error, starts polling
- **Poll errors**: Logged, retried on next interval

## Related Files

### In this project (mrcall-dashboard)

| File | Purpose |
|------|---------|
| `src/utils/Zylch.js` | Zylch API client (training + chat methods) |
| `src/views/business/BusinessConfiguration.vue` | Training button + status, "Configure with AI" button |
| `src/views/ConfigureAI.vue` | AI chat page + training status sidebar |
| `src/components/ZylchChat.vue` | Chat component for Zylch AI |

### In Zylch backend (~/hb/zylch)

| File | Purpose |
|------|---------|
| `zylch/api/routes/mrcall.py` | Training status + start endpoints |
| `zylch/agents/trainers/mrcall_configurator.py` | Selective retraining logic, snapshot diff |
| `zylch/services/command_handlers.py` | `/agent mrcall train` handler |
| `zylch/storage/supabase_client.py` | Snapshot storage methods |
| `zylch/tools/mrcall/config_tools.py` | Inline snapshot update on variable changes |

## Related Documentation

- **Zylch-side docs**: `zylch/docs/features/mrcall-integration.md` (describes the integration from Zylch's perspective)
- **Zylch architecture**: `zylch/docs/ARCHITECTURE.md` (section "MrCall Dashboard Integration")
- **Dashboard dev plan**: `DASHBOARD_ZYLCH_DEVELOPMENT_PLAN.md` (original development plan)

---

**Last Updated**: March 2026
