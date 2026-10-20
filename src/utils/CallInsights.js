import axios from "axios";
import { isSessionEnded } from "@/firebase/session";

/**
 * What a call said, read from StarChat's call insights (brief and plan
 * `docs/briefs/2026-10-20-call-insights.md`, `docs/execution-plans/2026-10-20-call-insights.md`;
 * the contract is StarChat's own conversation-analytics API reference, §7-10, and its customer
 * conversation API guide).
 *
 * THE OUTCOME RULE, in one place. `booked` and `transferred` are recorded facts: the server itself
 * saw a booking or calendar skill create or move an event, or a transfer connect. Every other
 * outcome (`resolved`, `message_taken`, `unresolved`, `caller_left`, `spam_wrong_number`) is the
 * assistant's own judgement of how the call went, and every place an outcome is shown marks it as
 * such, until StarChat calibrates it (Mycelium 5e6dbb40). `outcomeKind` is the one function that
 * decides which is which; nothing else in the dashboard tests an outcome key directly.
 */
const FACT_OUTCOMES = ["booked", "transferred"];
const ASSESSED_OUTCOMES = ["resolved", "message_taken", "unresolved", "caller_left", "spam_wrong_number"];
const OUTCOME_KEYS = [...FACT_OUTCOMES, ...ASSESSED_OUTCOMES];

// `unanswered[].gap` (the conversation API guide) and `quality.gaps` / report `gap_calls`
// (the analytics reference, §8, §10) share this one set of reasons.
const GAP_KEYS = ["missing_info", "needs_integration", "out_of_scope", "assistant_error"];

// `details.checks` and `quality.checks`: true is a bad sign in all three.
const CHECK_KEYS = ["caller_repeated", "caller_unsatisfied", "promise_not_kept_in_call"];

function outcomeKind(key) {
    return FACT_OUTCOMES.includes(key) ? "fact" : "assessed";
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

export default {
    outcomeKind,
    FACT_OUTCOMES,
    ASSESSED_OUTCOMES,
    OUTCOME_KEYS,
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
