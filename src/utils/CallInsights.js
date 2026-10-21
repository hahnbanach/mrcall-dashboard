import axios from "axios";
import { isSessionEnded } from "@/firebase/session";

/**
 * What a call said, read from StarChat's call insights, version 2 (brief and plan
 * `docs/briefs/2026-10-20-call-insights.md`, `docs/execution-plans/2026-10-20-call-insights.md`;
 * the contract is StarChat's code: `CallDetailsView`, `OutcomesResponse`, `QualityResponse`,
 * `AssistantSignals`, `CustomerConversationSearch`).
 *
 * THE VALUE TABLE, in one place. A call carries four dimensions:
 * - `resolution` and `message` are the assistant's own judgement, shown by their label and marked
 *   "assessed by the assistant" until StarChat calibrates them (Mycelium 5e6dbb40); absent shows
 *   nothing.
 * - `booked` (true or false) is a fact the server recorded, shown as such; absent shows nothing.
 * - `transferred` is a fact the carrier reported: StarChat writes only `true`. Absent on a
 *   version-2 call (one that carries `booked`, which version 2 always writes) is "not known",
 *   never "no": the carrier may report no transfer leg, or not yet.
 * - A call without version-2 insights shows none of the four.
 * `insightRows` is the one function that applies the table; nothing else in the dashboard tests a
 * value of these four directly.
 */
const RESOLUTION_KEYS = ["resolved", "unresolved", "handed_over", "caller_left", "spam_wrong_number"];
const MESSAGE_KEYS = ["complete", "incomplete", "unintelligible", "none"];
const ASSESSED_DIMENSIONS = ["resolution", "message"];

// `unanswered[].gap` (the conversation API guide) and `quality.gaps` / report `gap_calls`
// (the analytics reference, §8, §10) share this one set of reasons.
const GAP_KEYS = ["missing_info", "needs_integration", "out_of_scope", "assistant_error"];

// `details.checks` and `quality.checks`: true is a bad sign in all three.
const CHECK_KEYS = ["caller_repeated", "caller_unsatisfied", "promise_not_kept_in_call"];

function isAssessed(dimension) {
    return ASSESSED_DIMENSIONS.includes(dimension);
}

function insightRows(details) {
    const d = details || {};
    const rows = [];
    if (RESOLUTION_KEYS.includes(d.resolution)) rows.push({ dimension: "resolution", value: d.resolution, assessed: true });
    if (MESSAGE_KEYS.includes(d.message)) rows.push({ dimension: "message", value: d.message, assessed: true });
    const versionTwo = typeof d.booked === "boolean";
    if (versionTwo) rows.push({ dimension: "booked", value: String(d.booked), assessed: false });
    if (d.transferred === true) rows.push({ dimension: "transferred", value: "true", assessed: false });
    else if (versionTwo) rows.push({ dimension: "transferred", value: "unknown", assessed: false });
    return rows;
}

const ANALYTICS_BASE = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/customer/analytics";
const INSIGHTS_BASE = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/customer/insights";

function getHeaders(user) {
    return {
        "Content-type": "application/json; charset=UTF-8",
        "auth": user.accessToken
    };
}

/*
 * A 404 means "nothing here for you" (out of scope, or a role the route is not for): the section
 * is simply absent, not a failure. A 503 (reports and its two scope-wide routes, while StarChat's
 * reports table migration has not run) is "not yet", not a failure either. A session-ended error
 * is the axios interceptor already on its way to sign-in, and is rethrown untouched so a component
 * can still recognise it with `isSessionEnded`. Anything else is the caller's own toast to show.
 */
function unwrap(promise) {
    return promise.then((response) => response.data).catch((error) => {
        if (isSessionEnded(error)) throw error;
        const status = error && error.response ? error.response.status : null;
        if (status === 404) return null;
        if (status === 503) return { unavailable: true };
        throw error;
    });
}

/**
 * The answer to keep when one section of a page asks again before its previous answer came back
 * (a new period, business or sort): only the latest. `begin()` marks a new request and returns a
 * check that stays true only while no later one has begun, so a slower earlier answer, or its
 * error, is dropped instead of replacing the newer numbers.
 */
function latestOnly() {
    let latest = 0;
    return {
        begin() {
            const mine = ++latest;
            return () => mine === latest;
        },
    };
}

export default {
    insightRows,
    latestOnly,
    isAssessed,
    RESOLUTION_KEYS,
    MESSAGE_KEYS,
    GAP_KEYS,
    CHECK_KEYS,

    // StarChat cuts the series in this IANA zone and answers 400 to a zone it does not know
    // (Analytics.js's own timeseries carries the same refusal): the call is refused here, before
    // the request, rather than sending the literal "undefined".
    outcomes: function (user, body, granularity, timezone) {
        if (!timezone) return Promise.reject(new Error("CallInsights.outcomes: timezone is required"));
        return unwrap(axios.post(
            ANALYTICS_BASE + "/outcomes?granularity=" + encodeURIComponent(granularity) +
                "&timezone=" + encodeURIComponent(timezone),
            body,
            { headers: getHeaders(user) }
        ));
    },
    quality: function (user, body) {
        return unwrap(axios.post(ANALYTICS_BASE + "/quality", body, { headers: getHeaders(user) }));
    },
    assistants: function (user, body, sort, limit) {
        return unwrap(axios.post(
            ANALYTICS_BASE + "/assistants?sort=" + encodeURIComponent(sort) + "&limit=" + encodeURIComponent(limit),
            body,
            { headers: getHeaders(user) }
        ));
    },
    // `before` is the previous page's last `periodEnd`; omit it for the first page.
    reports: function (user, businessId, before, limit) {
        let url = INSIGHTS_BASE + "/reports?businessId=" + encodeURIComponent(businessId);
        if (before != null) url += "&before=" + encodeURIComponent(before);
        if (limit != null) url += "&limit=" + encodeURIComponent(limit);
        return unwrap(axios.get(url, { headers: getHeaders(user) }));
    },
    report: function (user, businessId, periodStart) {
        const url = INSIGHTS_BASE + "/reports/" + encodeURIComponent(periodStart) +
            "?businessId=" + encodeURIComponent(businessId);
        return unwrap(axios.get(url, { headers: getHeaders(user) }));
    },
    // Across the caller's whole scope since `since` (StarChat defaults to 30 days when omitted):
    // this does not read a business, an owner, a plan or an end date.
    integrations: function (user, since) {
        const body = since != null ? { timestampGte: since } : {};
        return unwrap(axios.post(INSIGHTS_BASE + "/integrations", body, { headers: getHeaders(user) }));
    },
    configSuggestions: function (user, since) {
        const body = since != null ? { timestampGte: since } : {};
        return unwrap(axios.post(INSIGHTS_BASE + "/config-suggestions", body, { headers: getHeaders(user) }));
    },
};
