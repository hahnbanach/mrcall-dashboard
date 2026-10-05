import axios from "axios";

/**
 * How long a business keeps its calls, as StarChat serves it to the owner
 * (/apidomain/retention/{businessId}): the terms in force, what the business set, the defaults a
 * term left unset takes, and the revision a write has to present.
 *
 * Terms are days; -1 is never; null leaves a term to the default. The server decides: a term below
 * -1 answers 422 `retention.invalid_term`, a revision somebody else moved 409.
 */
function url(businessId) {
    return process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/apidomain/retention/" + encodeURIComponent(businessId);
}

function headers(user) {
    return { "Content-type": "application/json; charset=UTF-8", "auth": user.accessToken };
}

export default {
    get: async function(user, businessId) {
        const response = await axios.get(url(businessId), { headers: headers(user) });
        return response.data;
    },

    /** Resolves to the new description, or rejects with the server's error body as `error.retention`. */
    put: async function(user, businessId, terms, expectedRevision) {
        try {
            const response = await axios.put(url(businessId), {
                archiveAfterDays: terms.archiveAfterDays,
                deleteAfterDays: terms.deleteAfterDays,
                trashDeleteAfterDays: terms.trashDeleteAfterDays,
                expectedRevision: expectedRevision || ""
            }, { headers: headers(user) });
            return response.data;
        } catch (e) {
            e.retention = e.response && e.response.data ? e.response.data : null;
            throw e;
        }
    }
};
