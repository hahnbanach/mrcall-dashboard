# Hide setup controls for saved active booking

The TEST assistant has five saved enabled skills, one accessible calendar and no
pending booking edit, but the chat displays calendar selection because a managed
conversation marker is absent. Saved skill readiness and guided conversation
alignment are different facts; a marker must not force calendar reconfiguration.

Expose an additive configured flag on the existing owned booking status response,
based on five saved enabled members, one accessible destination and no pending
booking operations. Preserve state/token/alignment checks and all activation/write
safeguards. Dashboard hides the setup card when configured or state=active; explicit
local failure/recovery remains visible. Disabled/incomplete groups and pending
booking edits retain setup controls. Do not read semantic prompt meaning or write
customer skills, prompt, calendar or history. No new translation is required.

Check actual service/API status and browser visibility for saved active markerless,
active, disabled, pending edit and failed activation states. Publish backend and
dashboard to TEST as explicitly requested, verify exact runtime/assets and preserve
production. Live calls and provider actions are outside scope.
