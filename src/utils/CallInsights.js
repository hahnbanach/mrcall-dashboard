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
// `forwarded` (StarChat's brief docs/briefs/2026-10-24-call-resolution-forwarded.md): the caller asked for something the
// assistant could not give in the call, and it took the request for the business to act on. One more entry of the list,
// read wherever the list is read; a version-2 call never carries it, and its `resolved` stays what it said.
const RESOLUTION_KEYS = ["resolved", "forwarded", "handed_over", "unresolved", "caller_left", "spam_wrong_number"];
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
 * - Resolution is a share only over the calls where the caller asked something (resolved, forwarded,
 *   handed_over, unresolved: four lines adding up to the base). `caller_left` (the caller spoke and never said what
 *   they wanted) and `spam_wrong_number` are counted beside that base, never in it, and neither is a failure.
 * - The calls the assistant had no conversation in (`noConversation`) are facts outside every rate:
 *   counted by reason, never as a share.
 * - An extraction problem is `http_error` or `failed`, over the calls whose extraction ran:
 *   `not_managed` is a call never asked of the model, neither a problem nor in the base.
 */
const RESOLUTION_REQUEST_KEYS = ["resolved", "forwarded", "handed_over", "unresolved"];
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

/*
 * The outcome of the calls where the caller asked something (StarChat's `OutcomesResponse.outcome`, plan step F3 of
 * docs/execution-plans/2026-10-24-call-resolution-forwarded.md): resolution and message read together into four lines
 * that add up to `callsWithRequest`, the second split by the message the assistant took. The base and every count are
 * StarChat's; nothing here adds resolution keys up. An answer without `outcome` (a server before F3) has no lines.
 */
const OUTCOME_LINES = [
    { key: "resolved", parts: ["resolved"] },
    { key: "forwarded", parts: ["forwarded_complete", "forwarded_incomplete"] },
    { key: "handed_over", parts: ["handed_over"] },
    { key: "unresolved", parts: ["unresolved"] },
];
const OUTCOME_KEYS = OUTCOME_LINES.flatMap((line) => line.parts);

function outcomeShare(outcomes) {
    const o = outcomes && outcomes.outcome;
    if (!o || typeof o !== "object" || !o.totals || typeof outcomes.callsWithRequest !== "number") return null;
    const base = outcomes.callsWithRequest;
    const t = o.totals;
    const prev = o.previousTotals || {};
    return {
        base,
        lines: OUTCOME_LINES.map((line) => {
            const count = sumOf(t, line.parts);
            const previous = sumOf(prev, line.parts);
            return {
                key: line.key,
                ...share(count, base),
                previous,
                parts: line.parts.length > 1 ? line.parts.map((key) => ({ key, ...share(t[key], base) })) : [],
            };
        }),
    };
}

// `caller_left` and `spam_wrong_number`: counted beside the outcome, never in its base.
function outsideRows(resolutionTotals) {
    const t = resolutionTotals || {};
    return RESOLUTION_OUTSIDE_KEYS.map((key) => ({ key, count: t[key] || 0 }));
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
    // StarChat's own count (`notSolved`: unresolved, and forwarded with an incomplete message) over its own base
    not_solved: (row) => share(row.notSolved, row.callsWithRequest),
    caller_silent: (row) => share(row.noConversation && row.noConversation.caller_silent, row.callsAnswered),
    not_answered: (row) => share(row.noConversation && row.noConversation.not_answered, row.callsOffered),
    caller_left: (row) => share(row.resolution && row.resolution.caller_left, row.callsWithResolution),
    unanswered: (row) => share(row.callsWithUnanswered, row.callsWithUnansweredRecorded),
    // the calls with at least one check true, each call once, as StarChat sorts the column (`callsWithAnyCheck`): a sum
    // of the checks counted a call with two of them twice, and could pass 100% (the U17b review, B3)
    checks: (row) => share(row.callsWithAnyCheck, row.callsWithChecks),
    skill_errors: (row) => share(row.callsWithSkillErrors, row.totalCalls),
    // Over the calls whose extraction ran (`ok`, `http_error`, `failed`), as the quality section counts
    // the same problems (`extractionProblems`). No fallback to totalCalls, which also counts calls never
    // put to the model: a row without `extractionsRun` has no base, and shows "0% (n of 0)".
    extraction_failures: (row) => share(row.extractionsNotOk, row.extractionsRun),
};

/*
 * The change of "Non risolte" against the period before of the same length (StarChat U13c: `previousNotSolved` over
 * `previousCallsWithRequest`): the share now minus the share before, in percentage points, rounded once at the end.
 * Null when either period has no call with a request: no share to compare, said as a dash, never as 0.
 */
function notSolvedChange(row) {
    const r = row || {};
    if (typeof r.notSolved !== "number" || !(r.callsWithRequest > 0)) return null;
    if (typeof r.previousNotSolved !== "number" || !(r.previousCallsWithRequest > 0)) return null;
    return Math.round((r.notSolved / r.callsWithRequest - r.previousNotSolved / r.previousCallsWithRequest) * 100);
}

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
 * is simply absent, not a failure. A 503 (reports and the routes over them, while StarChat's
 * migrations have not run) is "not yet", not a failure either. A session-ended error
 * is the axios interceptor already on its way to sign-in, and is rethrown untouched so a component
 * can still recognise it with `isSessionEnded`. Anything else is the caller's own error state.
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

/*
 * What an action (an estimate, a job, a delete, a dismissal) answers when StarChat refuses it with one of its closed
 * codes (`InsightsRefusal`: `{code, message, jobId}`, the code being the contract): the code and the job it names, or
 * null when the failure is no refusal (a network error, a 500, a 400 without a code).
 */
function refusalOf(error) {
    const data = error && error.response ? error.response.data : null;
    if (!data || typeof data !== "object" || typeof data.code !== "string") return null;
    return { code: data.code, status: error.response.status, jobId: typeof data.jobId === "string" ? data.jobId : null };
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
 * The page size of every server-paged list of these pages: 10 rows, inside StarChat's 1-100 bound.
 */
const PAGE_SIZE = 10;

// One page as StarChat answers it. Anything else (a shape this code does not know) is an empty page: never items read
// off an answer it cannot read.
function pageOf(answer, itemsKey = "items") {
    if (!answer || typeof answer !== "object" || !Array.isArray(answer[itemsKey])) {
        return { total: 0, items: [], asOf: undefined };
    }
    const items = answer[itemsKey];
    const total = typeof answer.total === "number" ? answer.total : 0;
    return { total: Math.max(total, items.length), items, asOf: answer.asOf };
}

// A business is shown by its company name; StarChat omits the name when the business has none or
// it could not be read, and then the id is all there is.
function businessLabel(name, businessId) {
    return typeof name === "string" && name.trim() !== "" ? name.trim() : businessId;
}

/**
 * THE ONE MECHANISM for a list StarChat pages (docs/briefs/2026-10-24-insights-reports-ux.md, "Throughout"): the
 * reports' history, the jobs, the assistants, a category's businesses, MrCall's configuration suggestions. It holds
 * the page shown, its total, the sort and its direction, and the one state the view draws (`InsightsState.vue`):
 * `loading`, `ok`, `absent` (404: not for this caller, the section hides), `unavailable` (503: not yet) and `error`
 * (anything else, with a retry). The page is chosen by number (`goTo`), never accumulated.
 *
 * `fetchPage({offset, size, asOf, sort, direction})` answers StarChat's page (or null / {unavailable}, `unwrap`);
 * `read(answer)` turns it into `{items, total, asOf}` (`pageOf` by default). The first page goes without `asOf`;
 * every other page of the same listing sends back the first page's, so that a row landing meanwhile does not shift
 * the pages (StarChat's snapshot). A new sort or a refresh starts again from the first page, without it.
 */
function serverPage(fetchPage, { size = PAGE_SIZE, sort = null, direction = "desc", read = pageOf, onError = null } = {}) {
    const gate = latestOnly();
    const state = reactive({
        status: "loading",
        items: [],
        total: 0,
        offset: 0,
        size,
        asOf: undefined,
        sort,
        direction,
        // the whole last answer, for what a page carries beside its rows (the reports' schedule)
        answer: null,
        get empty() {
            return state.status === "ok" && state.items.length === 0;
        },
        load(offset = 0, { keepAsOf = false } = {}) {
            const isCurrent = gate.begin();
            state.status = "loading";
            const asOf = keepAsOf ? state.asOf : undefined;
            return Promise.resolve()
                .then(() => fetchPage({ offset, size: state.size, asOf, sort: state.sort, direction: state.direction }))
                .then((answer) => {
                    if (!isCurrent()) return;
                    if (answer === null) { reset("absent"); return; }
                    if (answer && answer.unavailable) { reset("unavailable"); return; }
                    const page = read(answer);
                    state.items = page.items;
                    state.total = page.total;
                    state.offset = offset;
                    state.asOf = page.asOf != null ? page.asOf : asOf;
                    state.answer = answer;
                    state.status = "ok";
                })
                .catch((error) => {
                    if (!isCurrent()) return;
                    if (isSessionEnded(error)) return;
                    state.status = "error";
                    if (onError) onError(error);
                });
        },
        refresh() {
            return state.load(0);
        },
        goTo(offset) {
            return state.load(Math.max(0, offset), { keepAsOf: true });
        },
        retry() {
            return state.load(state.offset, { keepAsOf: true });
        },
        // A header clicked: the same column turns its direction, another starts descending.
        setSort(key) {
            if (state.sort === key) state.direction = state.direction === "desc" ? "asc" : "desc";
            else { state.sort = key; state.direction = "desc"; }
            return state.load(0);
        },
    });
    function reset(status) {
        state.status = status;
        state.items = [];
        state.total = 0;
        state.offset = 0;
        state.asOf = undefined;
        state.answer = null;
    }
    return state;
}

/*
 * A report asked for an interval carries the id of the job that asked (`requestId`) and no cadence; an
 * automatic one its cadence and no `requestId` (StarChat's `CallReportView`). An automatic and an asked
 * report can cover the same days, so a report is known by its start and its request id together.
 */
function isOnRequest(report) {
    return !!(report && typeof report.requestId === "string" && report.requestId !== "");
}

function reportKey(report) {
    return report.periodStart + ":" + (isOnRequest(report) ? report.requestId : "");
}

/*
 * An example call of a report as StarChat names it when it answers (`exampleCalls`, analytics guide §10): its
 * caller, the contact's name as the conversation list shows it or else its number, and when it started, in the
 * reader's locale; the start alone without a caller. Null for a call StarChat did not name (deleted since), whose
 * place in the list is then all there is to say.
 */
function exampleCallName(report, id, locale) {
    const label = report && report.exampleCalls ? report.exampleCalls[id] : null;
    if (!label || typeof label.startTimestamp !== "number") return null;
    const when = new Date(label.startTimestamp).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
    const caller = typeof label.caller === "string" ? label.caller.trim() : "";
    return caller ? caller + ", " + when : when;
}

function query(params) {
    const parts = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v));
    return parts.length ? "?" + parts.join("&") : "";
}

export default {
    insightRows,
    isOnRequest,
    reportKey,
    exampleCallName,
    unkeptRows,
    firedChecks,
    latestOnly,
    isAssessed,
    refusalOf,
    unwrap,
    RESOLUTION_KEYS,
    MESSAGE_KEYS,
    GAP_KEYS,
    CHECK_KEYS,
    UNKEPT_ACTIONS,
    RESOLUTION_REQUEST_KEYS,
    RESOLUTION_OUTSIDE_KEYS,
    NO_CONVERSATION_KEYS,
    ASSISTANT_SORT_KEYS,
    OUTCOME_LINES,
    OUTCOME_KEYS,
    outcomeShare,
    outsideRows,
    noConversationRows,
    extractionProblems,
    assistantShare,
    notSolvedChange,
    PAGE_SIZE,
    pageOf,
    businessLabel,
    serverPage,

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
    // One page of the assistants table (StarChat's analytics guide §9): `sort` and `direction` its order, `from` and
    // `size` the page, `search` a company name to narrow it to. Answers `{businesses, total, from, size, ...}`.
    assistants: function (user, body, { sort, direction = "desc", from = 0, size = PAGE_SIZE, search } = {}) {
        return unwrap(axios.post(
            ANALYTICS_BASE + "/assistants" + query({ sort, direction, from, size, search }),
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
    // What the pages need of one business, read once: its company name, its time zone (a report's days are its
    // days), its owner (a requester named as the owner) and its plan (a FREE owner is offered no paid work).
    // `crm/business?id=` answers a list. Not `Business.getBusiness`, which also rewrites the store's role from the
    // answer's header and forces a token refresh. A 404 (out of scope) is null.
    business: function (user, businessId) {
        return unwrap(axios.get(BUSINESS_URL + "?id=" + encodeURIComponent(businessId), { headers: getHeaders(user) }))
            .then((answer) => {
                const b = Array.isArray(answer) ? answer[0] : null;
                if (!b) return null;
                const text = (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
                const contact = [b.name, b.surname].map(text).filter(Boolean).join(" ");
                return {
                    businessId,
                    name: text(b.companyName),
                    timeZone: text(b.timezoneStr),
                    owner: text(b.owner),
                    ownerName: contact || text(b.emailAddress),
                    subscriptionStatus: text(b.subscriptionStatus),
                    template: text(b.template),
                };
            });
    },
    businessName: function (user, businessId) {
        return this.business(user, businessId).then((b) => (b ? b.name : null));
    },
    // Businesses whose company name contains `term`, for the admin's business filter (`crm/business/search` reads
    // `companyName` with LIKE, case-insensitive). Not `Business.checkUserHasBusinesses`, which rewrites the role.
    searchBusinesses: function (user, term, limit = 10) {
        const like = "%" + String(term || "").trim().replace(/[%_]/g, "") + "%";
        return unwrap(axios.post(BUSINESS_URL + "/search", { companyName: like, offset: 0, limit }, { headers: getHeaders(user) }))
            .then((answer) => (Array.isArray(answer) ? answer : [])
                .filter((b) => b && b.businessId)
                .map((b) => ({ businessId: b.businessId, name: businessLabel(b.companyName, b.businessId) })));
    },
    // An owner by name, for the admin page's owner filter: StarChat's admin user record carries only the
    // role (`FirebaseUserRegistryItem`), so the name is the contact its first business was registered
    // with (`name surname`, else its e-mail). An approximation: an owner whose businesses name another
    // contact shows that contact. Not `Business.checkUserHasBusinesses`, which rewrites the store's role.
    ownerName: function (user, ownerId) {
        return unwrap(axios.post(BUSINESS_URL + "/search", { owner: ownerId, offset: 0, limit: 1 }, { headers: getHeaders(user) }))
            .then((answer) => {
                const business = Array.isArray(answer) ? answer[0] : null;
                if (!business) return null;
                const name = [business.name, business.surname].filter((v) => typeof v === "string" && v.trim() !== "").map((v) => v.trim()).join(" ");
                if (name) return name;
                return typeof business.emailAddress === "string" && business.emailAddress.trim() !== "" ? business.emailAddress.trim() : null;
            });
    },

    // ---- Reports (docs/briefs/2026-10-24-insights-reports-ux.md, Routes) ----

    // One page of a business's history: `{items, total, asOf, schedule}`. `status` (done, claimed, failed,
    // budget_exhausted, written_off) and `type` (automatic, requested) filter it; `sort` (periodEnd, createdAt, calls)
    // and `direction` order it. Asking `size` is what selects the page (the cursor list without it is dashboard
    // v2.2.32's, which this code never reads).
    reportsPage: function (user, businessId, { offset = 0, size = PAGE_SIZE, asOf, status, type, sort, direction } = {}) {
        return unwrap(axios.get(INSIGHTS_BASE + "/reports" + query({ businessId, size, offset, asOf, status, type, sort, direction }),
            { headers: getHeaders(user) }));
    },
    // The automatic report starting at `periodStart`, or with `requestId` the one asked for an interval.
    report: function (user, businessId, periodStart, requestId) {
        return unwrap(axios.get(INSIGHTS_BASE + "/reports/" + encodeURIComponent(periodStart) + query({ businessId, requestId }),
            { headers: getHeaders(user) }));
    },
    // What [from, to) has in common with the business's reports: `{identical?, cycle?, past}`.
    overlap: function (user, businessId, from, to) {
        return unwrap(axios.get(INSIGHTS_BASE + "/reports/overlap" + query({ businessId, from, to }), { headers: getHeaders(user) }));
    },
    // An admin's delete of one report, every revision of it, with a reason. Throws on a refusal (`refusalOf`).
    deleteReport: function (user, { businessId, periodStart, periodEnd, requestId, reason }) {
        return axios.delete(INSIGHTS_BASE + "/reports/" + encodeURIComponent(periodStart) + query({ businessId, periodEnd, requestId, reason }),
            { headers: getHeaders(user) }).then((response) => response.data);
    },

    // ---- Jobs: an estimate, then the paid job it bounds (the same docs, "Charging and the cap") ----

    // `body`: `{businessId, kind: report | recompute | automatic_now, from?, to?, regenerates?, idempotencyKey}`.
    // Answers the estimate job (202); its `estimate` (`fits`, `reason`, the counts) once it is done.
    estimate: function (user, body) {
        return axios.post(INSIGHTS_BASE + "/estimate", body, { headers: getHeaders(user) }).then((response) => response.data);
    },
    // `kind` report or recompute; `body` carries `estimateJobId` and the same idempotency key on a retry, so a
    // double click or a lost answer finds the one job.
    createJob: function (user, kind, body) {
        if (kind !== "report" && kind !== "recompute") return Promise.reject(new Error("CallInsights.createJob: kind is report or recompute"));
        return axios.post(INSIGHTS_BASE + "/jobs/" + kind, body, { headers: getHeaders(user) }).then((response) => response.data);
    },
    job: function (user, jobId) {
        return unwrap(axios.get(INSIGHTS_BASE + "/jobs/" + encodeURIComponent(jobId), { headers: getHeaders(user) }));
    },
    // `{items, total}`, newest first; `kind` and `status` narrow it on the server (Elaborazioni's filters).
    jobs: function (user, businessId, { offset = 0, size = PAGE_SIZE, kind, status } = {}) {
        return unwrap(axios.get(INSIGHTS_BASE + "/jobs" + query({ businessId, offset, size, kind, status }), { headers: getHeaders(user) }));
    },
    cancelJob: function (user, jobId) {
        return axios.post(INSIGHTS_BASE + "/jobs/" + encodeURIComponent(jobId) + "/cancel", {}, { headers: getHeaders(user) })
            .then((response) => response.data);
    },

    // ---- "Richieste dei chiamanti" (the same docs, "Caller requests across businesses") ----

    // The categories of the window `body` names (`timestampGte`, `timestampLte`, `plan`): `{total, asOf, from, to,
    // items}`, one row per category, at most the active categories, so the answer is never paged.
    // `all`: every request, the ones the assistant fulfilled too; without it StarChat counts the others only (its brief
    // docs/briefs/2026-10-26-classification-feedback.md, decision 13).
    requestCategories: function (user, body, { includeDismissed = false, sort = "score", asOf, language, all = false } = {}) {
        return unwrap(axios.post(INSIGHTS_BASE + "/integrations" + query({ view: "categories", includeDismissed, sort, asOf, language, all: all ? "true" : undefined }),
            body, { headers: getHeaders(user) }));
    },
    // The businesses that asked in a category: `{total, asOf, items}`, a page of them.
    requestBusinesses: function (user, category, body, { from = 0, size = PAGE_SIZE, asOf } = {}) {
        return unwrap(axios.post(INSIGHTS_BASE + "/integrations/" + encodeURIComponent(category) + "/businesses" + query({ from, size, asOf }),
            body, { headers: getHeaders(user) }));
    },
    dismissCategory: function (user, category, { reason, note }) {
        return axios.post(INSIGHTS_BASE + "/integrations/" + encodeURIComponent(category) + "/dismiss", { reason, note },
            { headers: getHeaders(user) }).then((response) => response.data);
    },
    restoreCategory: function (user, category) {
        return axios.post(INSIGHTS_BASE + "/integrations/" + encodeURIComponent(category) + "/restore", {},
            { headers: getHeaders(user) }).then((response) => response.data);
    },
    dismissExample: function (user, category, { text, reason, note }) {
        return axios.post(INSIGHTS_BASE + "/integrations/" + encodeURIComponent(category) + "/examples/dismiss", { text, reason, note },
            { headers: getHeaders(user) }).then((response) => response.data);
    },
    restoreExample: function (user, category, text) {
        return axios.post(INSIGHTS_BASE + "/integrations/" + encodeURIComponent(category) + "/examples/restore", { text },
            { headers: getHeaders(user) }).then((response) => response.data);
    },
    // MrCall's configuration suggestions, admin only: `{total, asOf, items}`, a page of businesses.
    configSuggestions: function (user, since, { from = 0, size = PAGE_SIZE, asOf } = {}) {
        return unwrap(axios.post(INSIGHTS_BASE + "/config-suggestions" + query({ from, size, asOf }),
            since != null ? { timestampGte: since } : {}, { headers: getHeaders(user) }));
    },
};
