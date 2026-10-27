# Booking connection and activation in chat

## Intent and ownership

The operator requests schedule → five booking skills → existing Connect Calendar
button → activation after successful connection. The screenshot also shows a
collapsed chat/composer overlapping a connection card and oversized skill reviews.
The backend counterpart is mrcall-agent's workstream with the same dated slug.

Reuse BusinessSkillConnection/GoogleAuthFlow/GoogleCallback and their existing
owner, business, state/digest, PKCE and safe-return checks. Add a booking-specific
continuation over backend-owned status and activation actions. Never post raw
skill parameters, invent grant identities or move credentials into chat. A named
calendar choice is part of connecting; customers never type technical calendar IDs.

## Source acceptance

- Prepare exactly five separate calendar skills. Support unsaved creates and an
  unambiguous already-saved disabled group. Preserve unrelated proposals and edits.
- The connection action clearly includes activation. Only a matching explicit
  return intent may complete automatically with a single verified calendar;
  multiple calendars require a choice by name. Selection completes the scoped
  activation through the backend's snapshot-bound action and existing Save writer.
- Denied/invalid consent, changed owner/business/setup, malformed/empty lists,
  active or uncertain attempts and partial writes do not report booking active or
  silently retry. Generic OAuth/manual editor behavior remains unchanged.
- Show the Connect action when supported. Advanced settings is fallback-only.
  Hide fixed backend English booking summaries; use the model's final reply and
  translate new UI copy in all 12 locales. Retain ordinary tool summaries.
- Collapse technical runtime instructions and templates. Keep compact skill names,
  activation state and schedule facts readable. Desktop/mobile browser bounding
  checks prove chat composer, connection card and review do not overlap.
- Focused authenticated browser fixtures intercept analytics/external traffic;
  cancellation, return, calendar choice, activation outcome and saved-view refresh
  are checked. This is not actual customer consent or a real-model quality claim.

## Mandatory delivery after source approval

Deploy the reviewed dashboard candidate to TEST and coordinate with the backend's
main→dev deployment. Verify served artifact identity and pipeline success. No
production/beta tag is authorized. Source closure/final review precede publication;
separate final delivery review follows actual readiness. The backend owner clears
the authorized assistant's conversation after deployment, preserving saved skills.
The operator performs actual Google consent and real-model chat verification.
