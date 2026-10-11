import axios from "axios";
import { stateOf, toMin } from "@/utils/RestaurantModel";

/**
 * A restaurant's book, as StarChat serves it to the people of the business
 * (/apidomain/restaurant/{businessId}), and the restaurant_booking instance the page reads its hours from
 * and writes the minimum free time to (/apidomain/agent/skills/configuration/{businessId}).
 *
 * THE ONE PLACE THE WIRE SHAPES LIVE. Every request the page makes, and the translation of every answer
 * into the shapes the page draws, is here. The shapes are StarChat 9.34.63's
 * (ApiDomainRestaurantResource, LayoutDraft, RestaurantLayoutSection, the restaurant_booking manifest).
 *
 * Every write answers the server's own words: a refusal rejects with the server body as `error.restaurant`
 * (`code` is its first diagnostic's code: `full`, `stale`, `large_party`, `busy_retry`, ...), so the page
 * says a translated sentence for the code and never the server's English.
 */

/** The one name the platform runs the skill under: its skills index has no other, so an instance written
 * under another name takes no call and its configuration cannot be saved (skill_unknown). */
export const SKILL = "skill_restaurant_booking";

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
    };
}

/**
 * A row of the day read as the page draws it: minutes since midnight, the tables it holds, the state it is
 * in, and the calls that touched it: `callIds` in the order they happened, each once, the first being the
 * call that made the booking (`conversationId`); a staff booking or a walk-in has none.
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
    };
    row.state = stateOf(row);
    return row;
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
     * carries the moves; none fits, `refusal` is why (full, closed, ...).
     */
    suggestions: async function(user, businessId, date, time, covers, zone) {
        const answer = await call(() => axios.get(base(businessId) + "/suggestions?date=" + encodeURIComponent(date) + "&time=" +
            encodeURIComponent(time) + "&covers=" + encodeURIComponent(covers) + (zone ? "&zone=" + encodeURIComponent(zone) : ""),
            { headers: headers(user) }));
        return {
            fits: (answer.suggestions || []).map(s => ({ ids: (s.tableIds || []).slice(), zone: s.zone, zoneName: s.zoneName || "",
                minutes: s.minutes, moves: s.moves || [] })),
            refusal: answer.refusal || null,
        };
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

    noShow: function(user, businessId, id, expectedVersion) {
        return call(() => axios.post(base(businessId) + "/reservations/" + encodeURIComponent(id) +
            "/no-show?expectedVersion=" + encodeURIComponent(expectedVersion), {}, { headers: headers(user) }));
    },

    /** The layout and its revision, or null for a business that has none yet. */
    layout: async function(user, businessId) {
        const answer = await call(() => axios.get(base(businessId) + "/layout", { headers: headers(user) }));
        return layoutFromWire(answer && answer.layout);
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

    /** The book from `from` to `to` as a CSV file the server writes (a person only). */
    exportCsv: function(user, businessId, from, to) {
        return call(() => axios.get(base(businessId) + "/export?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to),
            { headers: headers(user), responseType: "blob" }));
    },

    /**
     * The restaurant_booking instance of the business and the revision of its phase, or null when the
     * business has none. `params` is the instance configuration as the read returns it.
     */
    instance: async function(user, businessId) {
        const configuration = await call(() => axios.get(skillsBase(businessId), { headers: headers(user) }));
        const revisions = (configuration && configuration.revisions) || {};
        for (const phase of Object.keys(revisions)) {
            const entries = Array.isArray(configuration[phase]) ? configuration[phase] : [];
            const entry = entries.find(e => e && e.skill === SKILL);
            if (entry) return { phase: phase, instanceId: entry.instanceId, params: entry.params || {}, revision: revisions[phase] };
        }
        return null;
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
        const params = Object.assign({}, instance.params, changes);
        delete params.layout;
        return call(() => axios.put(skillsBase(businessId) + "/" + encodeURIComponent(instance.phase) + "/" +
            encodeURIComponent(instance.instanceId),
            { skill: SKILL, params: params, expectedRevision: instance.revision }, { headers: headers(user) }));
    }
};
