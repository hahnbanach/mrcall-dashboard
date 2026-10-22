import axios from "axios";
import { reactive } from "vue";
import { isSessionEnded } from "@/firebase/session";

/**
 * What a call said, read from StarChat's call insights, version 2 (brief and plan
 * `docs/briefs/2026-10-20-call-insights.md`, `docs/execution-plans/2026-10-20-call-insights.md`;
 * the contract is StarChat's code: `CallDetailsView`, `OutcomesResponse`, `QualityResponse`,
 * `AssistantSignals`, `TopicsResponse`, `CustomerConversationSearch`).
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
 * `unkept` (a list of `{action, said}`, GPT-Live calls) is what the assistant told the caller it had
 * done and StarChat's record does not show done: `action` is the model's reading (book, move, cancel,
 * transfer; anything else is shown under a neutral label, never as the raw key) and `said` its words,
 * shown as text and never translated. `unkeptRows` reads it: an absent, empty or malformed list is
 * nothing. While it has entries, the check `promise_not_kept_in_call` states the same fact, so
 * `firedChecks` leaves that line out; on every other call it shows as any check does.
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

const UNKEPT_ACTIONS = ["book", "move", "cancel", "transfer"];

/*
 * Brief outcome 9 (StarChat intent 12): the assistant is measured only on the calls it could serve.
 * The bases below are StarChat's own (its analytics guide §7-§9, `OutcomesResponse`,
 * `AssistantSignals`); the dashboard reads each from the answer rather than rebuilding it, so a
 * column always shows the share StarChat sorts the rows by.
 * - Resolution is a share only over the calls where the caller asked something (resolved,
 *   unresolved, handed_over). `caller_left` (the caller spoke and never said what they wanted) and
 *   `spam_wrong_number` are counted beside that base, never in it, and neither is a failure.
 * - The calls the assistant had no conversation in (`noConversation`) are facts outside every rate:
 *   counted by reason, never as a share.
 * - An extraction problem is `http_error` or `failed`, over the calls whose extraction ran:
 *   `not_managed` is a call never asked of the model, neither a problem nor in the base.
 */
const RESOLUTION_REQUEST_KEYS = ["resolved", "unresolved", "handed_over"];
const RESOLUTION_OUTSIDE_KEYS = ["caller_left", "spam_wrong_number"];
const NO_CONVERSATION_KEYS = ["caller_silent", "no_credit", "talk_and_hangup", "not_answered"];
const EXTRACTION_PROBLEM_KEYS = ["http_error", "failed"];
const EXTRACTION_RAN_KEYS = ["ok", ...EXTRACTION_PROBLEM_KEYS];

function share(count, base) {
    const safeCount = count || 0;
    const safeBase = base || 0;
    return { count: safeCount, base: safeBase, percent: safeBase > 0 ? Math.round((safeCount / safeBase) * 100) : 0 };
}

function sumOf(map, keys) {
    const m = map || {};
    return keys.reduce((sum, key) => sum + (m[key] || 0), 0);
}

function resolutionShare(totals) {
    const t = totals || {};
    const base = sumOf(t, RESOLUTION_REQUEST_KEYS);
    return {
        base,
        rows: RESOLUTION_REQUEST_KEYS.map((key) => ({ key, ...share(t[key], base) })),
        outside: RESOLUTION_OUTSIDE_KEYS.map((key) => ({ key, count: t[key] || 0 })),
    };
}

function noConversationRows(noConversation) {
    const n = noConversation || {};
    return NO_CONVERSATION_KEYS.map((key) => ({ key, count: n[key] || 0 }));
}

function extractionProblems(extractions) {
    return { count: sumOf(extractions, EXTRACTION_PROBLEM_KEYS), base: sumOf(extractions, EXTRACTION_RAN_KEYS) };
}

// StarChat's `sort` keys for the assistants table, in the order the table shows them. Every key but
// `calls` is a share, each over the base the row returns beside its count (analytics guide §9).
const ASSISTANT_SORT_KEYS = [
    "calls", "not_solved", "caller_silent", "not_answered", "caller_left",
    "unanswered", "checks", "skill_errors", "extraction_failures",
];
const ASSISTANT_SHARES = {
    not_solved: (row) => share(row.resolution && row.resolution.unresolved, row.callsWithRequest),
    caller_silent: (row) => share(row.noConversation && row.noConversation.caller_silent, row.callsAnswered),
    not_answered: (row) => share(row.noConversation && row.noConversation.not_answered, row.callsOffered),
    caller_left: (row) => share(row.resolution && row.resolution.caller_left, row.callsWithResolution),
    unanswered: (row) => share(row.callsWithUnanswered, row.callsWithUnansweredRecorded),
    checks: (row) => share(sumOf(row.checks, CHECK_KEYS), row.callsWithChecks),
    skill_errors: (row) => share(row.callsWithSkillErrors, row.totalCalls),
    extraction_failures: (row) => share(row.extractionsNotOk, row.totalCalls),
};

function assistantShare(row, key) {
    const of = ASSISTANT_SHARES[key];
    if (!of) throw new Error("CallInsights.assistantShare: " + key + " is not a share");
    return of(row || {});
}

function unkeptRows(details) {
    const list = details && details.unkept;
    if (!Array.isArray(list)) return [];
    return list
        .filter((entry) => entry && typeof entry === "object" && typeof entry.said === "string" && entry.said.trim() !== "")
        .map((entry) => ({
            action: UNKEPT_ACTIONS.includes(entry.action) ? entry.action : null,
            said: entry.said,
        }));
}

function firedChecks(details) {
    const checks = (details && details.checks) || {};
    const hasUnkept = unkeptRows(details).length > 0;
    return CHECK_KEYS.filter((key) => checks[key] === true && !(hasUnkept && key === "promise_not_kept_in_call"));
}

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
const BUSINESS_URL = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/business";

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


/*
 * The two scope-wide lists (integrations and information asked, MrCall's configuration suggestions)
 * are paged by StarChat (analytics guide §10, its intent 13): the page shows one page and asks for
 * the next only when the user does, so a platform with thousands of reports never loads them all.
 * 20 is StarChat's own default size, inside its 1-100 bound.
 */
const INSIGHTS_PAGE_SIZE = 20;

function sinceBody(since) {
    return since != null ? { timestampGte: since } : {};
}

function pageUrl(base, from, size, asOf) {
    let url = base + "?from=" + encodeURIComponent(from != null ? from : 0) +
        "&size=" + encodeURIComponent(size != null ? size : INSIGHTS_PAGE_SIZE);
    if (asOf != null) url += "&asOf=" + encodeURIComponent(asOf);
    return url;
}

// One page as StarChat answers it. Anything else (the bare list served before the paging, a test's
// generic `[]`) is an empty page: never items read off a shape this code does not know.
function pageOf(answer) {
    if (!answer || typeof answer !== "object" || !Array.isArray(answer.items)) {
        return { total: 0, items: [], asOf: undefined };
    }
    const total = typeof answer.total === "number" ? answer.total : 0;
    return { total: Math.max(total, answer.items.length), items: answer.items, asOf: answer.asOf };
}

// A business is shown by its company name; StarChat omits the name when the business has none or
// it could not be read, and then the id is all there is.
function businessLabel(name, businessId) {
    return typeof name === "string" && name.trim() !== "" ? name.trim() : businessId;
}

// The businesses StarChat names for an integrations item (`said`, at most 5) and how many of the
// item's `businesses` it does not name.
function saidBy(item) {
    const said = item && Array.isArray(item.said) ? item.said : [];
    const businesses = (item && item.businesses) || 0;
    return { said, more: Math.max(0, businesses - said.length) };
}

/**
 * A scope-wide list read one page at a time, on demand: the one mechanism both lists and both
 * pages use, so loading, the end of the list, a 404 (absent), a 503 (not available yet) and a
 * failure are handled once. `fetchPage(from, size, asOf)` is one of the two clients above.
 *
 * Paging is by offset, so a report landing between two reads could shift the list. StarChat's
 * snapshot answers that: the first page's `asOf` is sent back on every later page of the same list,
 * and a new first page (a refresh) starts without it. `keyOf` drops an item already shown, which
 * only matters if a server without the snapshot shifts the list; a skipped item cannot be detected
 * here, which is what the snapshot is for.
 */
function pagedList(fetchPage, { size = INSIGHTS_PAGE_SIZE, keyOf = null, onError = null } = {}) {
    const gate = latestOnly();
    const state = reactive({
        status: "loading",
        items: [],
        total: 0,
        asOf: undefined,
        loadingMore: false,
        // A page past the end (no items) ends the list even if `total` says otherwise.
        exhausted: false,
        get hasMore() {
            return state.status === "ok" && !state.exhausted && state.items.length < state.total;
        },
        first() {
            const isCurrent = gate.begin();
            state.status = "loading";
            state.loadingMore = false;
            state.asOf = undefined;
            return fetchPage(0, size, undefined).then((answer) => {
                if (!isCurrent()) return;
                if (answer === null) { reset("absent"); return; }
                if (answer && answer.unavailable) { reset("unavailable"); return; }
                const page = pageOf(answer);
                state.items = page.items;
                state.total = page.total;
                state.asOf = page.asOf;
                state.exhausted = page.items.length === 0;
                state.status = "ok";
            }).catch((error) => {
                if (!isCurrent()) return;
                reset("absent");
                report(error);
            });
        },
        more() {
            if (state.loadingMore || !state.hasMore) return Promise.resolve();
            const isCurrent = gate.begin();
            state.loadingMore = true;
            return fetchPage(state.items.length, size, state.asOf).then((answer) => {
                if (!isCurrent()) return;
                const page = pageOf(answer);
                const seen = keyOf ? new Set(state.items.map(keyOf)) : null;
                const fresh = seen ? page.items.filter((item) => !seen.has(keyOf(item))) : page.items;
                if (fresh.length === 0) state.exhausted = true;
                state.items = state.items.concat(fresh);
                state.total = Math.max(page.total, state.items.length);
            }).catch((error) => {
                // the items already shown stay, and so does the button to try again
                if (isCurrent()) report(error);
            }).finally(() => {
                if (isCurrent()) state.loadingMore = false;
            });
        },
    });
    function reset(status) {
        state.status = status;
        state.items = [];
        state.total = 0;
        state.asOf = undefined;
        state.exhausted = false;
    }
    function report(error) {
        if (isSessionEnded(error)) return;
        if (onError) onError(error);
    }
    return state;
}

export default {
    insightRows,
    unkeptRows,
    firedChecks,
    latestOnly,
    isAssessed,
    RESOLUTION_KEYS,
    MESSAGE_KEYS,
    GAP_KEYS,
    CHECK_KEYS,
    UNKEPT_ACTIONS,
    RESOLUTION_REQUEST_KEYS,
    RESOLUTION_OUTSIDE_KEYS,
    NO_CONVERSATION_KEYS,
    ASSISTANT_SORT_KEYS,
    resolutionShare,
    noConversationRows,
    extractionProblems,
    assistantShare,
    INSIGHTS_PAGE_SIZE,
    pageOf,
    businessLabel,
    saidBy,
    pagedList,

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
    // One business's topics (StarChat's analytics guide §11): StarChat answers a body without a
    // business 400, so the call is refused here, before the request; the page asks only when exactly
    // one business is chosen.
    topics: function (user, body) {
        if (!body || !body.businessId) return Promise.reject(new Error("CallInsights.topics: businessId is required"));
        return unwrap(axios.post(ANALYTICS_BASE + "/topics", body, { headers: getHeaders(user) }));
    },
    // The company name of one business, for a page that names it and has no answer that does (an
    // owner's own business page): `crm/business?id=` answers a list. Not `Business.getBusiness`, which
    // also rewrites the store's role from the answer's header and forces a token refresh. A 404 (out
    // of scope) is no name.
    businessName: function (user, businessId) {
        return unwrap(axios.get(BUSINESS_URL + "?id=" + encodeURIComponent(businessId), { headers: getHeaders(user) }))
            .then((answer) => {
                const business = Array.isArray(answer) ? answer[0] : null;
                const name = business && business.companyName;
                return typeof name === "string" && name.trim() !== "" ? name.trim() : null;
            });
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
    // this does not read a business, an owner, a plan or an end date. One page of `{total, items}`
    // (`asOf` too, from StarChat's paging snapshot), `from` and `size` in the query (StarChat's
    // analytics guide §10); `asOf` only on a later page of the same list, never on a first one.
    integrations: function (user, since, from, size, asOf) {
        return unwrap(axios.post(pageUrl(INSIGHTS_BASE + "/integrations", from, size, asOf), sinceBody(since), { headers: getHeaders(user) }));
    },
    configSuggestions: function (user, since, from, size, asOf) {
        return unwrap(axios.post(pageUrl(INSIGHTS_BASE + "/config-suggestions", from, size, asOf), sinceBody(since), { headers: getHeaders(user) }));
    },
};
