# Restaurant bookings page

<!-- doc-scope:start -->
Scope: The "Restaurant bookings" page and the restaurant skill's card in the skill form: which settings each owns,
the page switch, the tabs, what every booking must carry, staff warnings and refusals, call-back requests (apply,
Undo, book anyway, restore anyway), the allergies setting, the session rules, and the StarChat routes and fields the
page uses.
<!-- doc-scope:end -->

The page is the restaurant's book on StarChat's named tables: the evening by service, the room, the hours and rules.
StarChat decides everything (whether a party fits, where it sits, what a write may change); the page asks, shows the
answer in the owner's language, and never the server's English. The wire contract is StarChat's
`src/main/resources/apidoc/openapi.yaml` (repository `hahnbanach/starchat`, line 9.34), generated from the routes
that serve it; the paths below are under `/mrcall/v1/{realm}/apidomain/`. The work's brief and plan are StarChat's
`docs/briefs/2026-10-10-restaurant-named-tables-and-host-page.md` and
`docs/execution-plans/2026-10-10-restaurant-named-tables-and-host-page.md`.

## Where it lives

| Part | File |
|---|---|
| The page, its tabs, every write and its Undo | `src/components/widgets/RestaurantBook.vue` |
| The panels and editors | `src/components/widgets/restaurant/` (`RestaurantDayView`, `RestaurantNewPanel`, `RestaurantBookingPanel`, `RestaurantDetailsEditor`, `RestaurantAcceptPanel`, `RestaurantRoomEditor`, `RestaurantRulesEditor`, `RestaurantAskEditor`, `RestaurantWizard`, `RestaurantDataPanel`) |
| Every request and the translation of every answer | `src/utils/Restaurant.js` |
| What the page computes from the answers (clock, closures, notes join, a request's change) | `src/utils/RestaurantModel.js` |
| The skill card: hidden page fields, the page switch, the page-off data panel | `src/components/widgets/skills/SkillCard.vue`, `manifestFields.js`, `skillPages.js` |
| The menu entry and the section | `src/views/business/BusinessConfiguration.vue` |

The menu entry is the synthetic section `__RESTAURANT_BOOKING__`, shown when the business has an instance of the
skill under either of the names StarChat reads it under (`skill_restaurant_booking` or `restaurant_booking`,
`SKILL_NAMES` in `Restaurant.js`) in the `during` phase, with its page on.

## The page and the skill form: one editor per setting

Every setting has one editor. The restaurant manifest marks the restaurant's facts `x-audience: page` (carried by
the skill catalogue as `audience: "page"`): the generic skill form draws none of them, for owners and admins alike,
and lists them under "Set in the restaurant page" with a link to the page's "Hours and rules" tab. The page writes
only those settings (`PAGE_FIELDS` in `Restaurant.js`; `saveInstance` refuses any other key before sending):

- the lunch and dinner arrival windows, the arrival step, the table times, the most guests arriving together, the
  minimum free time, the book's horizon, the walk-in window, and "what we ask for every booking"
  (`requiredFields`);
- the room (zones, tables, joins) and the restaurant's closures, through the layout route, not the instance.

The skill form owns the assistant's policy: the largest party the assistant books, notice, days ahead (with a note
that they stop at the book's horizon), changes by phone (`phoneChanges`), callers without a verified identity
(`unverifiedCallers`), the calendar connection, the closure keyword in the calendar, and the prompts. A warning on
the page about one of these links to the skill form.

## The page switch and the assistant switch

For a skill whose manifest declares a boolean `page` field, the card's strip switches the page, and the assistant's
switch (`enabled`) sits inside the card. Turning the page off writes `page: false` and `enabled: false` in the same
edit, so the one save carries both: StarChat refuses an instance with the assistant on and the page off
(`assistant_without_page`) and does not turn the assistant off itself. The assistant switch is disabled while the
page is off. The refusal, should it come, is said in the owner's words.

With the page off, the menu has no entry and the section falls back to the default. StarChat answers the staff
routes `not_configured` at `/page`, except the export and the erasure, which a business keeps for its guests' data:
the skill card offers both under the switch (the erasure asked twice). A page opened while the page is off says so
and links to the skill form.

## The tabs

- **Evening** ("Serata"): the period strip, the day by service with the tables by zone or on a timeline, the
  bookings list with the requests to decide, the finder, the booking panel.
- **Room and tables**: zones, tables and joins, saved as one layout at the revision read, with an evening preview.
- **Hours and rules**: the restaurant's settings listed above, "what we ask for every booking", and one list of
  closures and special openings. A zone closed for whole days is stored in that zone's `closures`, everything else
  in the layout's `exceptions`; both are edited as one list. The closures read from the owner's calendar are shown
  read-only, marked "from the calendar", with when they were read and whether the last read failed; they are changed
  in the calendar.

A restaurant without a room opens on the first-run wizard (hours, then the room).

## What we ask for every booking

Day, time and people are always required. Name, phone, allergies, notes and area are each required, optional or not
asked (`requiredFields`, the manifest's defaults when unset). StarChat's book enforces it from every source; the page
follows it:

- the booking form does not draw a field not asked, marks a required one, and refuses an empty required one before
  sending;
- a walk-in may leave out name and phone only: the walk-in panel asks for the required allergies and notes, and for
  the area when it is required and no table is chosen;
- accepting a request that lacks a required field asks for it, and the accept carries it in the same call;
- a `missing_fields` refusal names each field from the diagnostic's `values.fields`;
- the details editor follows the setting; a field set to "not asked" that the booking still holds is shown, with a
  hint, so staff can read and clear it; a required field the booking never had is not demanded (the book checks only
  the fields a write sets or clears).

### The allergies setting

Asking every caller about allergies depends on a StarChat server setting, on in test and off in production until
the legal point is settled. The skill configuration read carries
`restaurant: {allergies: {stored, effective, requiredAvailable}}` for a business with a restaurant instance; the page
reads it through `Restaurant.allergiesSettingOf`. "Required" is offered only when `requiredAvailable` is true, and is
treated as not available when the field is absent. A stored "required" where it is not available is shown and kept,
with the note that it acts as optional. A save that newly chooses it there is refused
(`allergies_required_unavailable`) and said in the owner's words.

## Staff warnings and refusals

Staff are bound by structure only. Hours, the arrival grid, notice, the same-day cut-off, days ahead, the assistant's
largest party and pace are warnings (`outside_hours`, `off_grid`, `within_notice`, `after_same_day_cutoff`,
`beyond_days_ahead`, `above_max_party`, `over_pace`): the finder's answer carries them (`staff.warnings`) and the
booking form shows them before confirming; a move to another table asks them first and offers "move anyway"; a write's
answer carries them as `warnings` and the toast repeats them. A taken table, a past day, beyond the horizon, a closed
day, service or zone, and the required fields are refusals. Only `full` (a taken table) may be overridden ("book
anyway", `overbook: true`): the booking is recorded with no table yet and keeps the tables staff meant
(`intendedTableIds`), shown on the "no table yet" lane. Bookings on a day, service or zone closed after they were
taken stay; the page marks them and lists those of a closed service for staff to call.

## Call-back requests

A request the assistant records about an existing booking (a move, a details change, a late arrival or a cancellation
the caller could not make by phone) carries `about` (the booking's id), `aboutReservation` (`{id, date, time, covers,
name}`, wherever the booking is) and `change` (`{kind, date, time, covers, zone, name, notes, allergies, eta}`, `kind`
being the book's classification: `late_arrival`, `move`, `details` or `cancellation`). A booking with an open request
carries `openRequest` (`{id, version, date, kind, at, change}`), whatever day the request was filed for, so its card
and its row show the request on any day.

- **Make the change** opens the booking's details editor pre-filled from `change`: the asked name and allergies, the
  booking's notes with the caller's added (`RestaurantModel.joinNotes`, the book's own join: whole " · " segments,
  trimmed, each added once), and the move or the late arrival the request makes. Saving is one call,
  `POST .../reservations/{requestId}/apply`, with the request's and the booking's versions: the book applies the
  request by its kind and closes it in the same transaction. Only what staff changed in the editor travels, as an
  override that wins over the asked value; an unedited apply sends no field of its own. A cancellation is applied by
  "Cancel the booking" without the editor.
- **Book anyway**: an apply refused `full` offers it, and sends the same overrides with `overbook: true`.
- **Close without changing** declines the request alone, held for the Undo window like any decline.
- **Undo** of an apply is `POST .../reservations/{requestId}/unapply` with `{requestVersion, bookingVersion}` from the
  apply's answer: the booking goes back as it was (or is reinstated, or back overbooked with its intended tables) and
  the request is open again, in one transaction. Its refusals are said as putting something back; `full` and
  `table_taken` offer **Restore anyway** (`overbook: true`, back with no table); `superseded` (a newer request about
  the booking is open), `not_applied` and `stale` do not.
- Refusals of an apply, all said in the owner's words: `stale` at `/expectedVersion` (the request) or
  `/bookingVersion` (the booking), `not_linked`, `no_change`, `booking_not_confirmed`, and the booking write's own.

**The panel follows the booking.** After a details save, or a request applied through the details editor, the page
goes to the booking's day when it is not the one shown and opens its panel there. The Undo of a details save or of an
applied request (a cancellation included) first opens the booking it acts on, on its day, so a refusal and "restore
anyway" are said in its panel even when the person has moved to another day, and then follows the booking put back.
The Undo of a state, a pin, a cancellation or a no-show does not: those do not change the day.

## Session rules

The page has no 401 handling of its own: the Axios interceptor (`src/firebase/axiosConfig.js`) is the only owner of
a 401 and ends the session. Every restaurant catch block that would say something returns quietly when
`isSessionEnded(error)` is true; the restaurant components import it from `src/firebase/session.js`, a module with
no imports that `axiosConfig.js` re-exports, so they can be mounted in unit tests. The page adds no route: it is a
section of `/businessconfiguration`, which needs a session, and nothing in it is `meta.public`.

## The routes the page uses

Under `restaurant/{businessId}`, every request with the user's Firebase token in `auth`:

| Route | Use |
|---|---|
| `GET reservations?date=` | the day: rows with their tables, `freeTables`, `minFreeMinutes`, the day's `closures` and `zonesClosed`, the layout |
| `GET calendar?from=&to=&by=staff` | the period strip, a month at most, up to the book's horizon |
| `GET suggestions?date=&time=&covers=` | the finder, its later times, and `staff` (warnings or refusal of a staff booking then) |
| `POST search` | bookings by a part of the name or number |
| `POST reservations` | a staff booking or a walk-in (`walkIn`), with `idempotencyKey` |
| `PATCH reservations/{id}` | a move, a details change (an emptied field as `""`) |
| `DELETE reservations/{id}?expectedVersion=` | a cancellation, a declined request |
| `POST reservations/{id}/state`, `/pin`, `/no-show`, `/reinstate` | the evening's states, the pin, the no-show, and their Undo |
| `POST reservations/{id}/accept` | a request accepted, with the fields it lacked |
| `POST reservations/{id}/apply`, `/unapply` | a call-back request applied, and its Undo |
| `GET layout`, `PUT layout`, `POST layout/preview` | the room, its closures and exceptions, the calendar's closures (`calendar`) |
| `GET export?from=&to=`, `POST erasure` | the guests' data, kept with the page off |

And, for the skill: `GET agent/skills` (the catalogue: defaults, limits, `audience`), `GET` and
`PUT agent/skills/configuration/{businessId}[/{phase}/{instanceId}]` (the instance at its revision, and
`restaurant.allergies`).

Reservation rows carry, beside the booking's own fields: `tableIds`, `intendedTableIds`, `warnings` (on a write's
answer), `recognised` (the guest's number did not place the booking: marked on the row and the card), `about`,
`aboutReservation`, `change`, `openRequest`, `callIds`, `pastNoShows`, `cancelledBy` and `reinstatable`.

## Tests

`tests/e2e/fixtures/restaurant.js` is the book in memory the browser tests run against, in the shapes of StarChat's
openapi; `tests/e2e/auth/restaurant.spec.js`, `restaurant-owners.spec.js` and `skills-restaurant.spec.js` drive the
page and the skill card; `tests/unit/restaurantOwners.spec.js` asserts that the page writes only `x-audience: page`
fields and that the form draws none of them.
