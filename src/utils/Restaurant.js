import axios from "axios";
import { stateOf, toMin } from "@/utils/RestaurantModel";

/**
 * A restaurant's book, as StarChat serves it to the people of the business
 * (/apidomain/restaurant/{businessId}), and the restaurant_booking instance the page reads its hours from
 * and writes the minimum free time to (/apidomain/agent/skills/configuration/{businessId}).
 *
 * THE ONE PLACE THE WIRE SHAPES LIVE. Every request the page makes, and the translation of every answer
 * into the shapes the page draws, is here. The shapes are StarChat 9.34.65's restaurant routes
 * (ApiDomainRestaurantResource, LayoutDraft, RestaurantLayoutSection, the restaurant_booking manifest),
 * including the reinstatement (the Undo of a no-show or a staff cancellation), the staff search, the guest's
 * past no-shows and the finder's later times.
 *
 * Every write answers the server's own words: a refusal rejects with the server body as `error.restaurant`
 * (`code` is its first diagnostic's code: `full`, `stale`, `large_party`, `busy_retry`, ...), so the page
 * says a translated sentence for the code and never the server's English.
 */

/** The one name the platform runs the skill under: its skills index has no other, so an instance written
 * under another name takes no call and its configuration cannot be saved (skill_unknown). */
export const SKILL = "skill_restaurant_booking";

/** The names StarChat reads a restaurant_booking instance under (RestaurantCalendarProjection.SkillNames), and
 *  the one phase it reads it from (SkillPhaseConfiguration.RunningLoop, `during`). */
export const SKILL_NAMES = ["restaurant_booking", SKILL];
export const SKILL_PHASE = "during";

/**
 * The instance settings this page writes, and the only ones: each is marked `x-audience: page` in the
 * restaurant_booking manifest, so the skill form never draws it (brief, addendum 2026-10-12 (2): one editor per
 * field). The room (`layout`) is the page's too, but it is written through the layout route, never here.
 * `saveInstance` refuses any other key, so the page cannot become a second editor of a setting the form owns.
 */
export const PAGE_FIELDS = ["lunch", "dinner", "arrivalEveryMinutes", "coversPerArrival", "tableMinutes2", "tableMinutes4",
    "tableMinutes6", "tableMinutesLarger", "minFreeMinutes", "horizonDays", "walkInMinutes", "requiredFields"];

/** Everything the page edits: its settings and the room. What the skill form summarises with a link here. */
export const PAGE_EDITS = PAGE_FIELDS.concat(["layout"]);

/** The fields "Cosa chiediamo per ogni prenotazione" decides, in the order the page shows them. Day, time and
 *  covers are always required and are not among them. */
export const ASKED_FIELDS = ["name", "phone", "allergies", "notes", "zone"];
export const FIELD_RULES = ["required", "optional", "not_asked"];

/**
 * Whether "required" may be chosen for allergies here, and what the stored value does: StarChat's
 * `RestaurantRules.AllergiesSetting` (stored, effective, requiredAvailable), read once at its startup from a
 * server setting that is on in test and off in production until the owner settles the legal point (brief, "What
 * every reservation must carry", amended 2026-10-13).
 *
 * Read from the skill configuration GET's `restaurant: {allergies: {stored, effective, requiredAvailable}}`
 * (StarChat 9.34 at 7bf981c51, `SkillEditorFacts`), present only for a business with a restaurant_booking instance.
 * Without it the answer is null, and the page treats "required" as not available: it never offers a choice the
 * server may refuse without saying so. A stored "required" is still shown, with the note.
 */
export function allergiesSettingOf(configuration) {
    const raw = configuration && configuration.restaurant && configuration.restaurant.allergies;
    if (!raw || typeof raw !== "object" || typeof raw.requiredAvailable !== "boolean") return null;
    return { stored: raw.stored || null, effective: raw.effective || null, requiredAvailable: raw.requiredAvailable };
}

function base(businessId) {
    return process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/apidomain/restaurant/" + encodeURIComponent(businessId);
}

function skillsBase(businessId) {
    return process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/apidomain/agent/skills/configuration/" +
        encodeURIComponent(businessId);
}

function headers(user) {
    return { "Content-type": "application/json; charset=UTF-8", "auth": user.accessToken };
}

/** The code of the server's first diagnostic, or null. */
export function codeOf(error) {
    const body = error && error.response && error.response.data;
    const first = body && Array.isArray(body.diagnostics) ? body.diagnostics[0] : null;
    return first && first.code ? first.code : null;
}

async function call(request) {
    try {
        const response = await request();
        return response.data;
    } catch (e) {
        e.restaurant = { status: e.response ? e.response.status : null, code: codeOf(e),
            body: e.response ? e.response.data : null };
        throw e;
    }
}

/** Whether a failure is "this server has no such route": a 404 with no diagnostic of the book's own. */
export function isMissingRoute(e) {
    return !!(e && e.restaurant && e.restaurant.status === 404 && !e.restaurant.code);
}

/** Whether a failure is the book answering that the restaurant's page is off (R8: 409 not_configured on `/page`). */
export function isPageOff(e) {
    const body = e && e.restaurant && e.restaurant.body;
    const first = body && Array.isArray(body.diagnostics) ? body.diagnostics[0] : null;
    return !!(first && first.code === "not_configured" && first.path === "/page");
}

/**
 * Whether the instance has its page switched off (`page`, manifest default on, R8). Stored as the variables store a
 * boolean: "false" or false is off; nothing stored is the manifest's default, and without a manifest, on (an
 * instance saved before the switch existed keeps its page).
 */
export function pageOffIn(params, manifest) {
    const raw = params ? params.page : undefined;
    const def = manifest && manifest.page ? manifest.page.default : undefined;
    const v = raw === undefined || raw === null || String(raw).trim() === "" ? def : raw;
    return v !== undefined && v !== null && String(v).trim().toLowerCase() === "false";
}

/** A fresh key per write a person makes, so a retried request does not book twice. */
export function idempotencyKey() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

// ---------------------------------------------------------------- answers into the page's shapes

/** A zone, table and join as the page edits them. */
export function layoutFromWire(raw) {
    if (!raw) return null;
    return {
        revision: raw.revision === undefined ? null : raw.revision,
        zones: (raw.zones || []).map((z, i) => ({ id: z.id, name: z.name || "", order: z.order === undefined ? i : z.order,
            note: z.note || "", closures: (z.closures || []).map(c => ({ from: c.from, to: c.to })) })),
        tables: (raw.tables || []).map(t => ({ id: t.id, name: t.name || "", zone: t.zone, min: t.min, max: t.max, active: t.active !== false })),
        joins: (raw.joins || []).map(j => ({ tables: (j.tables || []).slice(), min: j.min, max: j.max })),
        // The restaurant's calendar exceptions written in the page (R8): closed days and services, special openings,
        // for the whole restaurant or a zone. A zone closed for whole days lives in that zone's `closures` instead.
        exceptions: (raw.exceptions || []).map(exceptionFromWire),
    };
}

function exceptionFromWire(e) {
    return { from: e.from, to: e.to || e.from, service: e.service || null, zone: e.zone || null, windows: (e.windows || []).slice() };
}

function exceptionToWire(e) {
    const out = { from: e.from, to: e.to || e.from };
    if (e.service) out.service = e.service;
    if (e.zone) out.zone = e.zone;
    if (e.windows && e.windows.length) out.windows = e.windows.slice();
    return out;
}

/** The calendar's closures beside the layout (GET /layout, R8): read-only here, with when they were last read. */
function calendarFromWire(raw) {
    const c = raw || {};
    return {
        closures: (c.closures || []).map(x => ({ date: x.date, service: x.service || null, zone: x.zone || null, title: x.title || "" })),
        readAt: c.readAt || null, triedAt: c.triedAt || null, outcome: c.outcome || null,
    };
}

/**
 * The layout as a save and the preview send it (LayoutDraft): a new table goes without an id and the server
 * assigns one; a join names a table that has no id yet by its name, names being unique in the layout; the
 * client never sends `nextTableId`. A table the page added carries a negative draft id, so on the wire it
 * loses the id and the joins name it. Tables the server numbered keep their ids.
 */
export function layoutToWire(draft) {
    const byId = new Map(draft.tables.map(t => [t.id, t]));
    return {
        zones: draft.zones.map((z, i) => ({ id: z.id, name: z.name.trim(), order: i, note: (z.note || "").trim() || undefined,
            closures: z.closures || [] })),
        tables: draft.tables.map(t => Object.assign(t.id > 0 ? { id: t.id } : {},
            { name: t.name.trim(), zone: t.zone, min: t.min, max: t.max, active: t.active })),
        joins: draft.joins.map(j => ({ tables: j.tables.map(id => (id > 0 ? id : byId.get(id).name.trim())), min: j.min, max: j.max })),
        // Always sent, so a save of the room keeps the exceptions the rules editor wrote, and the reverse.
        exceptions: (draft.exceptions || []).map(exceptionToWire),
    };
}

/**
 * A row of the day read as the page draws it: minutes since midnight, the tables it holds, the state it is
 * in, and the calls that touched it: `callIds` in the order they happened, each once, the first being the
 * call that made the booking (`conversationId`); a staff booking or a walk-in has none. `pastNoShows` is the
 * guest's earlier no-shows here (only for a guest with a number); `cancelledBy` says who cancelled (caller or
 * staff) and `reinstatable` whether staff may take a cancellation or a no-show back now.
 */
export function bookingFromWire(r) {
    const start = toMin(r.time);
    const row = {
        id: r.id, version: r.version, date: r.date, service: r.service, status: r.status, source: r.source,
        start, end: start + (r.minutes || 0), minutes: r.minutes, party: r.covers, zone: r.zone, zoneName: r.zoneName,
        name: r.name || "", phone: r.phone || "", allergies: r.allergies || "", notes: r.notes || "",
        requestReason: r.requestReason || null, overbooked: !!r.overbooked, pinned: !!r.pinned,
        serviceState: r.serviceState || null, tables: (r.tableIds || []).slice(),
        blockScope: r.blockScope || null, blockTableIds: r.blockTableIds || null,
        conversationId: r.conversationId || null,
        callIds: (r.callIds || []).slice(),
        pastNoShows: r.pastNoShows || 0,
        cancelledBy: r.cancelledBy || null,
        reinstatable: r.reinstatable === true,
        // A call-back request about a change of a booking (R8): the booking it names, wherever that booking is
        // (`aboutReservation`), and what the caller asked, classified by the book (`change.kind`).
        about: r.about || null,
        aboutReservation: r.aboutReservation ? { id: r.aboutReservation.id, date: r.aboutReservation.date,
            start: toMin(r.aboutReservation.time), party: r.aboutReservation.covers, name: r.aboutReservation.name || "" } : null,
        change: changeFromWire(r.change),
        // On a booking: its open call-back request, whatever day it was filed for (R8, StarChat c790d9d11): its id and
        // version, the day it was filed for, its kind, when it was written and what the caller asked.
        openRequest: r.openRequest && r.openRequest.id ? { id: r.openRequest.id, version: r.openRequest.version, date: r.openRequest.date || null,
            kind: r.openRequest.kind || null, at: r.openRequest.at || null, change: changeFromWire(r.openRequest.change) } : null,
        // The guest's number is not the one that placed the booking (R8): a call from it is recognised, not the owner's.
        recognised: r.recognised === true,
        // An overbooking's tables staff named, not held (R8): shown on "no table yet".
        intendedTables: (r.intendedTableIds || []).slice(),
        // What staff were warned of and not refused for, on a write's answer (R8).
        warnings: (r.warnings || []).map(w => w.code).filter(Boolean),
    };
    row.state = stateOf(row);
    return row;
}

/** StarChat's `change` on a call-back request (R8): its kind (late_arrival, move, details, cancellation) and what the
 *  caller asked, each key only when given; times as minutes of the day. */
function changeFromWire(c) {
    if (!c || !c.kind) return null;
    const out = { kind: c.kind };
    if (c.date) out.date = c.date;
    if (c.time) out.start = toMin(c.time);
    if (c.covers) out.party = c.covers;
    ["zone", "name", "notes", "allergies"].forEach(k => { if (c[k]) out[k] = c[k]; });
    if (c.eta) out.eta = toMin(c.eta);
    return out;
}

/** The day read's `freeTables`: per table id, the windows in which it is free for at least the minimum
 *  free time, as minutes of the day (a window past midnight ends at "24:30"). */
function freeTablesFromWire(raw) {
    const out = {};
    Object.keys(raw || {}).forEach(id => {
        out[Number(id)] = (raw[id] || []).map(w => ({ from: toMin(w.from), to: toMin(w.to) }));
    });
    return out;
}

/** The restaurant instance StarChat serves in a configuration read (see `instance`). */
export function instanceIn(configuration) {
    const revisions = (configuration && configuration.revisions) || {};
    const entries = configuration && Array.isArray(configuration[SKILL_PHASE]) ? configuration[SKILL_PHASE] : [];
    const entry = entries.find(e => e && SKILL_NAMES.includes(e.skill));
    return entry ? { phase: SKILL_PHASE, skill: entry.skill, instanceId: entry.instanceId, params: entry.params || {},
        revision: revisions[SKILL_PHASE], allergies: allergiesSettingOf(configuration) } : null;
}

function dayFromWire(raw) {
    return {
        minFreeMinutes: raw.minFreeMinutes === undefined ? null : raw.minFreeMinutes,
        freeTables: freeTablesFromWire(raw.freeTables),
        date: raw.date,
        configured: !!raw.configured,
        layout: layoutFromWire(raw.layout),
        reservations: (raw.reservations || []).map(bookingFromWire),
        heldTables: raw.heldTables || [],
        covers: raw.covers || {},
        zonesClosed: raw.zonesClosed || [],
        // The day's closures from either source (R8): {service, zone, source: page|calendar}. Bookings already on a
        // closed day or service stay; the page shows them for staff to call.
        closures: (raw.closures || []).map(c => ({ service: c.service || null, zone: c.zone || null, source: c.source || "page" })),
    };
}

export default {
    /** The day: reservations with their tables, requests, blocks, covers per service, the layout. A 404 with
     *  no diagnostic means this StarChat has no restaurant routes yet. */
    day: async function(user, businessId, date) {
        return dayFromWire(await call(() => axios.get(base(businessId) + "/reservations?date=" + encodeURIComponent(date),
            { headers: headers(user) })));
    },

    /** The period, at most a month, as staff may book it: per day and service whether it is open, the covers
     *  taken, the largest party that still fits and the bookable times for 2, 4 and 6. */
    period: function(user, businessId, from, to) {
        return call(() => axios.get(base(businessId) + "/calendar?from=" + encodeURIComponent(from) + "&to=" +
            encodeURIComponent(to) + "&by=staff", { headers: headers(user) }));
    },

    /**
     * The table finder: the seatings the assistant would give a party of `covers` at `time`, in the order it
     * would be given them (the first is its own), each free for the party's whole table time:
     * `{fits: [{ids, zone, zoneName, minutes, moves}], refusal}`. A fit found only by moving other bookings
     * carries the moves; none fits, `refusal` is why (full, closed, ...), and `later` the next arrival times of
     * the service at which the assistant would seat the party (a few at most), as minutes of the day.
     */
    suggestions: async function(user, businessId, date, time, covers, zone) {
        const answer = await call(() => axios.get(base(businessId) + "/suggestions?date=" + encodeURIComponent(date) + "&time=" +
            encodeURIComponent(time) + "&covers=" + encodeURIComponent(covers) + (zone ? "&zone=" + encodeURIComponent(zone) : ""),
            { headers: headers(user) }));
        return {
            fits: (answer.suggestions || []).map(s => ({ ids: (s.tableIds || []).slice(), zone: s.zone, zoneName: s.zoneName || "",
                minutes: s.minutes, moves: s.moves || [] })),
            refusal: answer.refusal || null,
            later: (answer.later || []).map(toMin).filter(t => t !== null),
            // A staff booking of this party then (R8): what it would be warned of, or why the book refuses it.
            staff: answer.staff ? { warnings: (answer.staff.warnings || []).map(w => w.code).filter(Boolean),
                refusal: answer.staff.refusal || null } : null,
        };
    },

    /**
     * Bookings by a part of the guest's name or number over a period (POST so the name never travels in a URL):
     * by default from a week ago to sixty days ahead, at most `limit` rows. `{results: [{date, b}], truncated}`.
     */
    search: async function(user, businessId, q, limit) {
        const answer = await call(() => axios.post(base(businessId) + "/search", Object.assign({ q }, limit ? { limit } : {}),
            { headers: headers(user) }));
        return { results: (answer.reservations || []).map(r => ({ date: r.date, b: bookingFromWire(r) })), truncated: !!answer.truncated };
    },

    /**
     * A no-show, or a booking staff cancelled, confirmed again on the tables it released, at the version read:
     * the Undo of both. Refused 409 `not_reversible` (`reason`: cancelled_by_caller, not_cancelled_or_no_show,
     * block, service_over) or 409 `table_taken` (`conflicts`: who holds each table now, `gone`: tables no longer
     * in the room); with `overbook` it is confirmed with no table yet.
     */
    reinstate: function(user, businessId, id, expectedVersion, overbook) {
        return call(() => axios.post(base(businessId) + "/reservations/" + encodeURIComponent(id) + "/reinstate?expectedVersion=" +
            encodeURIComponent(expectedVersion) + (overbook ? "&overbook=true" : ""), {}, { headers: headers(user) }));
    },

    book: function(user, businessId, booking) {
        return call(() => axios.post(base(businessId) + "/reservations",
            Object.assign({ idempotencyKey: idempotencyKey() }, booking), { headers: headers(user) }));
    },

    change: function(user, businessId, id, change) {
        return call(() => axios.patch(base(businessId) + "/reservations/" + encodeURIComponent(id), change,
            { headers: headers(user) }));
    },

    cancel: function(user, businessId, id, expectedVersion) {
        return call(() => axios.delete(base(businessId) + "/reservations/" + encodeURIComponent(id) +
            "?expectedVersion=" + encodeURIComponent(expectedVersion), { headers: headers(user) }));
    },

    /** arrived, seated, left, or null to undo the last one. */
    state: function(user, businessId, id, expectedVersion, state) {
        return call(() => axios.post(base(businessId) + "/reservations/" + encodeURIComponent(id) + "/state",
            { expectedVersion, state }, { headers: headers(user) }));
    },

    pin: function(user, businessId, id, expectedVersion, pinned) {
        return call(() => axios.post(base(businessId) + "/reservations/" + encodeURIComponent(id) + "/pin",
            { expectedVersion, pinned }, { headers: headers(user) }));
    },

    accept: function(user, businessId, id, body) {
        return call(() => axios.post(base(businessId) + "/reservations/" + encodeURIComponent(id) + "/accept", body,
            { headers: headers(user) }));
    },

    /**
     * Applies the call-back request `requestId` to the booking it is about and closes it, in one transaction (StarChat
     * 2d055d7e6): by the request's kind, a move, the details, a late arrival noted with the table kept, a cancellation.
     * `overrides` are staff's values over the asked ones (date, time, covers, zone, tableIds, eta, overbook, name,
     * phone, notes, allergies). Answers `{booking, request}`, the booking with its tables and `warnings`. A refusal
     * changes neither row: `stale` at /expectedVersion (the request) or /bookingVersion (the booking), `not_linked`,
     * `no_change`, `booking_not_confirmed`, or the booking write's own refusal.
     */
    applyRequest: function(user, businessId, requestId, expectedVersion, bookingVersion, overrides) {
        return call(() => axios.post(base(businessId) + "/reservations/" + encodeURIComponent(requestId) + "/apply",
            Object.assign({ expectedVersion, bookingVersion }, overrides || {}), { headers: headers(user) }));
    },

    /**
     * The reverse of `applyRequest` (StarChat 9c02e69d7): the booking put back as it was before the apply (its day, time,
     * covers, zone, tables and guest's fields) or reinstated on its tables, and the request open again, in one
     * transaction, at the versions the apply answered. `overbook` puts it back with no table when its tables are taken.
     * Answers `{booking, request}`; a refusal changes neither row: `stale` at /requestVersion or /bookingVersion,
     * `not_applied`, `superseded` (a newer request about the booking is open), or `full` / `table_taken`.
     */
    unapplyRequest: function(user, businessId, requestId, requestVersion, bookingVersion, overbook) {
        return call(() => axios.post(base(businessId) + "/reservations/" + encodeURIComponent(requestId) + "/unapply",
            Object.assign({ requestVersion, bookingVersion }, overbook ? { overbook: true } : {}), { headers: headers(user) }));
    },

    noShow: function(user, businessId, id, expectedVersion) {
        return call(() => axios.post(base(businessId) + "/reservations/" + encodeURIComponent(id) +
            "/no-show?expectedVersion=" + encodeURIComponent(expectedVersion), {}, { headers: headers(user) }));
    },

    /** The layout and its revision, or null for a business that has none yet. */
    layout: async function(user, businessId) {
        const answer = await call(() => axios.get(base(businessId) + "/layout", { headers: headers(user) }));
        return layoutFromWire(answer && answer.layout);
    },

    /** The layout with the closures read from the owner's calendar beside it: `{layout, calendar}`. */
    layoutWithCalendar: async function(user, businessId) {
        const answer = await call(() => axios.get(base(businessId) + "/layout", { headers: headers(user) }));
        return { layout: layoutFromWire(answer && answer.layout), calendar: calendarFromWire(answer && answer.calendar) };
    },

    /** Saves the whole layout at the revision read (null for the first): `{layout, warnings}`, or a refusal:
     *  422 with one diagnostic per problem (a table that still has bookings is named), 409 `stale`. */
    saveLayout: async function(user, businessId, expectedRevision, draft) {
        const answer = await call(() => axios.put(base(businessId) + "/layout",
            { expectedRevision: expectedRevision === undefined ? null : expectedRevision, layout: layoutToWire(draft) },
            { headers: headers(user) }));
        return { layout: layoutFromWire(answer.layout), warnings: answer.warnings || [] };
    },

    /** The evening a draft would sell, judged by the server before it is saved: `{date, problems, warnings,
     *  services}`. The draft is sent as a save sends it, and its problems are the ones the save would answer. */
    previewLayout: function(user, businessId, date, draft) {
        return call(() => axios.post(base(businessId) + "/layout/preview", { date, layout: layoutToWire(draft) },
            { headers: headers(user) }));
    },

    /** Clears one guest's data, by their number, from every booking of the business (a person only; cannot be undone):
     *  `{cleared}`, how many bookings it touched. Kept by the server with the page off, like the export. */
    erase: function(user, businessId, phone) {
        return call(() => axios.post(base(businessId) + "/erasure", { phone }, { headers: headers(user) }));
    },

    /** The book from `from` to `to` as a CSV file the server writes (a person only). */
    exportCsv: function(user, businessId, from, to) {
        return call(() => axios.get(base(businessId) + "/export?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to),
            { headers: headers(user), responseType: "blob" }));
    },

    /**
     * The restaurant_booking skill's configuration fields as the skill catalogue declares them (the manifest's
     * `config`): `{key: {default, min, max}}`, so an unset value is shown as the manifest's default, never a
     * number written here. Null when the catalogue cannot be read or does not list the skill: the page then says
     * so and offers to read it again, rather than drawing with numbers of its own.
     */
    manifest: async function(user, businessId) {
        try {
            const skills = await call(() => axios.get(process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/apidomain/agent/skills" +
                (businessId ? "?businessId=" + encodeURIComponent(businessId) : ""), { headers: headers(user) }));
            const skill = (Array.isArray(skills) ? skills : []).find(s => s && SKILL_NAMES.includes(s.name));
            const fields = skill && skill.configSchema && skill.configSchema.fields;
            if (!Array.isArray(fields) || !fields.length) return null;
            return Object.fromEntries(fields.map(f => [f.key, { key: f.key, default: f.default, min: f.min, max: f.max, audience: f.audience || null,
                labels: f.labels || null }]));
        } catch (e) {
            console.warn("Restaurant skill manifest not read:", e.restaurant ? e.restaurant.status : e);
            return null;
        }
    },

    /**
     * The restaurant_booking instance of the business and the revision of its phase, or null when the
     * business has none: the one StarChat serves, under either of its names, in the `during` phase only.
     * `params` is the instance configuration as the read returns it, the store-backed `layout` included.
     */
    instance: async function(user, businessId) {
        return instanceIn(await call(() => axios.get(skillsBase(businessId), { headers: headers(user) })));
    },

    /**
     * Writes the instance's configuration at the revision read, with `changes` over what was read: 409 when
     * somebody else wrote in between, 422 with diagnostics when the skill refuses it.
     *
     * The read carries the store-backed `layout` section (RestaurantLayoutSection); a write without it leaves
     * the layout untouched, which is what this write wants (the layout is saved by its own route), so the
     * section is never sent. `minFreeMinutes` is written as the string the variables hold, like every other
     * number of the instance (`x-encoding: json-string`).
     */
    saveInstance: function(user, businessId, instance, changes) {
        const foreign = Object.keys(changes).filter(k => !PAGE_FIELDS.includes(k));
        // The page edits its own settings only (PAGE_FIELDS); everything else has its one editor in the skill form.
        if (foreign.length) return Promise.reject(new Error("not a setting of the restaurant page: " + foreign.join(", ")));
        const params = Object.assign({}, instance.params, changes);
        delete params.layout;
        // A setting changed to null goes back to its default: it is left out, which StarChat reads as unset
        // (RestaurantRules.field: absent, null and empty text alike) and fills from the manifest.
        Object.keys(changes).forEach(k => { if (changes[k] === null) delete params[k]; });
        return call(() => axios.put(skillsBase(businessId) + "/" + encodeURIComponent(instance.phase) + "/" +
            encodeURIComponent(instance.instanceId),
            { skill: instance.skill || SKILL, params: params, expectedRevision: instance.revision }, { headers: headers(user) }));
    }
};
