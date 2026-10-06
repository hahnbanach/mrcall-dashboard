import axios from "axios";

/**
 * A restaurant's book, as StarChat serves it to the people of the business
 * (/apidomain/restaurant/{businessId}): the day read, staff bookings, moves, cancellations, requests to
 * accept, no-shows, blocks and stopping a service; and the restaurant_booking instance whose capacity
 * and tables the owner edits, written through the per-instance skill configuration route with the
 * revision it was read at.
 *
 * Every write answers the server's own words: a refusal rejects with the server body as `error.restaurant`
 * (`code` is its first diagnostic's code: `full`, `stale`, `large_party`, `busy_retry`, ...), so the page
 * shows a translated sentence for the code and never the server's English.
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

/** A fresh key per write a person makes, so a retried request does not book twice. */
export function idempotencyKey() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

export default {
    /** The day: reservations, held count, covers per service, seats, tables, the assistant's share and
     *  the occupancy per service and slot. A 404 means this StarChat has no restaurant routes yet. */
    day: function(user, businessId, date) {
        return call(() => axios.get(base(businessId) + "/reservations?date=" + encodeURIComponent(date),
            { headers: headers(user) }));
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

    accept: function(user, businessId, id, body) {
        return call(() => axios.post(base(businessId) + "/reservations/" + encodeURIComponent(id) + "/accept", body,
            { headers: headers(user) }));
    },

    noShow: function(user, businessId, id, expectedVersion) {
        return call(() => axios.post(base(businessId) + "/reservations/" + encodeURIComponent(id) +
            "/no-show?expectedVersion=" + encodeURIComponent(expectedVersion), {}, { headers: headers(user) }));
    },

    block: function(user, businessId, block) {
        return call(() => axios.post(base(businessId) + "/blocks",
            Object.assign({ idempotencyKey: idempotencyKey() }, block), { headers: headers(user) }));
    },

    stopSell: function(user, businessId, date, service) {
        return call(() => axios.post(base(businessId) + "/stop-sell",
            { date: date, service: service, idempotencyKey: idempotencyKey() }, { headers: headers(user) }));
    },

    /**
     * The restaurant_booking instance of the business and the revision of its phase, or null when the
     * business has none. `params` is the instance configuration as stored.
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

    /** Writes the instance's configuration at the revision read; 409 when somebody else wrote in between,
     *  422 with diagnostics when the skill refuses the configuration. */
    saveInstance: function(user, businessId, instance, params) {
        return call(() => axios.put(skillsBase(businessId) + "/" + encodeURIComponent(instance.phase) + "/" +
            encodeURIComponent(instance.instanceId),
            { skill: SKILL, params: params, expectedRevision: instance.revision }, { headers: headers(user) }));
    }
};
