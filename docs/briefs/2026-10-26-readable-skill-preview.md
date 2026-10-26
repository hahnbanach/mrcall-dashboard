# Readable skill review and truthful Google connection states

## Intent and evidence

Customers should review skill changes without raw enums, JSON, boolean tokens or
operation IDs. They must also be able to tell whether Google is authorized for
their account or for the selected assistant before an enabled booking Save.

The reported TEST case has an actual account-level Google connection matching
the requested calendar. Both Account and BusinessConfiguration currently render
ConnectCalendar without a business ID and therefore show the same global state.
That connected indicator is truthful about the account, but insufficient for
business skills: the retained read-only receipts show one active account-global
grant, no active grant for the assistant, and a not_connected skill resource
probe. The registry callback writes the account-global grant. Skill resolution
intentionally requires business scope and must not gain a global fallback.
This is a UI/authorization mismatch, not an omitted user action or a presumed
wrong assistant.

## Clean delivery base and scope

Work only in mrcall-dashboard-assistant-google-test, branch v2.2.33 at c2b2a589,
the exact deployed TEST v2.2.32 base. The earlier dirty-worktree candidate and its
110-case/build evidence are historical only: their source composition differs
from this deployed base. Do not bundle unrelated original working-tree edits.
No implementation precedes fresh brief and plan approval.

Port only the reviewed readable-summary, safe-refusal and business-target Google
consent changes, adapting minimal hunks to retain every deployed feature. In
particular preserve session guard/isSessionEnded, manifest-driven manual-editor
scopes, the legacy callback and providerAccountId behavior. The parent owns this
port and its separate integration gate. The UI worker owns the dependent M3
correction of both connection screens.

## Required behavior

- Preserve Account's account-global connect, picker, writes and disconnect
  behavior. Clarify its visible wording that this connection belongs to the
  account and does not itself authorize each assistant; do not portray the
  existing account-level connection as unavailable or invalid.
- On BusinessConfiguration, pass the current business ID to ConnectCalendar.
  Its business mode must show global connection information separately from
  the selected assistant's default Google authorization/availability status.
  Never present the account-global Connected-to state as assistant authorization.
- Determine business status through the existing authenticated calendars GET
  with exact businessId and empty grantName. A nonempty supported calendar list
  proves availability only, not booking readiness or a successful appointment.
  Empty, error, malformed or unavailable responses remain unknown; no claim of
  disconnection, revocation or absence follows from those responses alone.
- Offer explicit business-bound Google consent with owner/state/digest/PKCE,
  supported scopes and safe same-business return. The callback must send the
  exact businessId and empty grantName through the existing endpoint. Account
  consent remains global. Do not expose the global Disconnect control as an
  assistant disconnect: hide it in business mode rather than inventing a new
  revoke API or changing the account connection.
- Keep pending proposals and the explicit Save/resource-probe requirement.
  Consent return does not save, enable, book, mutate the pending grant reference
  or prove that a calendar can accept appointments. Named grants and the manual
  editor retain their existing paths and semantics.
- Retain readable localized pending summaries, explicit proposed activation,
  complete exact values under collapsed details and safe resource-refusal
  guidance. Preserve deployed chat session guard, Save/discard/recovery and
  existing operation IDs in their action bindings.

## Verification and acceptance

Test the real starting condition in a browser fixture: account-global connected
with the same calendar as the pending operation, no business grant, and distinct
states on Account versus assistant configuration. Test both screens, unchanged
Account-global write behavior, exact business status query and consent/callback,
retained drafts and explicit Save. Wrong-business, empty and revoked/unavailable
fixtures must not produce a positive assistant state; malformed responses remain
unknown. Both status loading and action failures must fail safely.

All new UI copy covers twelve locales. Run a meaningful combined browser suite,
focused lint and production build on this new composition; do not reuse the old
110-case count as current acceptance. Independently review the clean-base port
before M3, then M3 integration, documentation truth and final-user path. Preserve
newer deployed documentation, reconcile only affected contracts, and archive
superseded current-state passages verbatim.

## Limits

No backend fallback, token copying, migration, live grant write, real Google
consent, live Save/activation, deployment or production action is authorized.
No scope expansion beyond the two-screen status/consent correction and bounded
clean-base delivery of the reviewed UI changes. The coordinator owns release
and any unresolved deployment authority. Real consent and live booking remain
explicitly unverified after scripted acceptance.
