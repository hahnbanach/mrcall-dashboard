import axios from "axios";
import CallInsights from "@/utils/CallInsights";

/**
 * A call's judgements as a person checks, corrects and undoes them (docs/briefs/2026-10-27-classification-feedback.md;
 * StarChat's brief docs/briefs/2026-10-26-classification-feedback.md, decisions 6, 9, 12, 13 and 14). The contract is
 * StarChat's code: `InsightsFeedbackResource` and `InsightsFeedback` (judgements, signals, undo, queues, caller rules),
 * `CallInsightsReportResource` (a category's requests), `CustomerConversationSearch` with
 * `SessionTimescaleService.filterConditions` (the list's filters), `ConversationAccess` (audio link, access record).
 *
 * Three things live here and nowhere else:
 * - the closed value sets a chip offers, and who applies and who proposes (StarChat's `InsightsFeedback.status`);
 * - a chip's state, read from a judgement and the call's history;
 * - THE FILTER TABLE: which search filter each count of the analytics stands for (StarChat counts each with the same
 *   predicate as one filter, `filterConditions`; no answer carries the filter, so the mapping is this table), and the
 *   address of the conversations list that carries it, read back into a search body.
 */

const RESOLUTION_KEYS = CallInsights.RESOLUTION_KEYS;
const MESSAGE_KEYS = CallInsights.MESSAGE_KEYS;
// a request's outcome, `insights_call_requests.outcome` (StarChat `CallInsights`): met, taken, handed_over, neither,
// withdrawn
const REQUEST_OUTCOME_KEYS = ["met", "taken", "handed_over", "neither", "withdrawn"];
// the outcomes the assistant did not fulfil by itself: the categories view's default (decision 13)
const NOT_FULFILLED = ["taken", "handed_over", "neither"];
const FIELDS = ["resolution", "message", "outcome", "category"];
const REQUEST_FIELDS = ["outcome", "category"];
// StarChat's `RequestCategories.Unclassified`: the requests no category was given yet ("Da classificare")
const UNCLASSIFIED = "unclassified";

function onRequest(field) {
    return REQUEST_FIELDS.includes(field);
}

/** The values a chip on `field` offers; for a category the active ones of `categories` (`[{key, label, active}]`). */
function valuesOf(field, categories) {
    if (field === "resolution") return [...RESOLUTION_KEYS];
    if (field === "message") return [...MESSAGE_KEYS];
    if (field === "outcome") return [...REQUEST_OUTCOME_KEYS];
    if (field === "category") return Array.isArray(categories) ? categories.filter((c) => c && c.active !== false).map((c) => c.key) : [];
    throw new Error("Classifications.valuesOf: " + field + " is not a judgement");
}

/**
 * What a signed-in person's signal becomes (StarChat `InsightsFeedback.status`): "wrong" without a value is always a
 * proposal; a category is applied by an admin and proposed by anyone else; the rest is applied. The dashboard's every
 * reader is a signed-in person: an agent (an API key, a delegated token) never reaches these screens.
 */
function statusFor(field, signal, role) {
    if (signal === "wrong") return "proposed";
    if (field === "category" && role !== "admin") return "proposed";
    return "applied";
}

// Whether a history entry is about the judgement `where` names: `{field}` of the call, or `{field, requestId}`.
function about(where) {
    return (h) => h && h.field === where.field &&
        (onRequest(where.field) ? h.requestId === where.requestId : h.subject !== "request");
}

function historyOf(history, where) {
    return (Array.isArray(history) ? history : []).filter(about(where));
}

function newest(list) {
    return list.reduce((best, h) => (!best || (h.createdAt || 0) > (best.createdAt || 0) ? h : best), null);
}

/**
 * A chip's state: the effective value, the model's, and what it shows beside the value:
 * - `proposed`: the reader's own proposal waits ("Proposta inviata"), and `rejected` once refused ("Respinta");
 * - `applied`: the reader's proposal, applied by an admin ("Applicata");
 * - `confirmed`: a "right" signal is in force; `corrected`: a correction is in force ("Corretta", from, to, who, when);
 * - `model`: neither.
 * `canRestore`: the reader may revert the correction in force, its author or an admin (StarChat `mayDecide`).
 */
function chipState(judgement, history, where, role) {
    const j = judgement || {};
    const mine = historyOf(history, where);
    const inForce = newest(mine.filter((h) => h.status === "applied"));
    const ownLatest = newest(mine.filter((h) => h.byMe && h.status !== "reverted"));
    let kind = "model";
    if (ownLatest && ownLatest.status === "proposed") kind = "proposed";
    else if (ownLatest && ownLatest.status === "rejected" && (!inForce || (ownLatest.decidedAt || 0) >= (inForce.createdAt || 0))) kind = "rejected";
    else if (inForce && inForce.signal === "right") kind = "confirmed";
    else if (inForce && inForce.byMe && statusFor(where.field, inForce.signal, role) === "proposed") kind = "applied";
    else if (inForce) kind = "corrected";
    const correction = inForce ? {
        feedbackId: inForce.feedbackId, from: inForce.valueFrom, to: inForce.valueTo,
        who: inForce.actorName || null, role: inForce.actorRole || null, when: inForce.createdAt, byMe: !!inForce.byMe,
    } : null;
    return {
        value: j.value != null ? j.value : null,
        model: j.model != null ? j.model : null,
        kind,
        correction,
        canRestore: !!inForce && (inForce.byMe === true || role === "admin"),
    };
}

/** A chip's menu: every value with the current one marked, then "right", "wrong", "restore" when allowed, "history".
 * A category whose list is not known offers nothing (the chip is not drawn: brief, gap table). */
function menuEntries(field, state, categories) {
    const values = valuesOf(field, categories);
    if (values.length === 0) return [];
    const s = state || {};
    const entries = values.map((value) => ({ kind: "value", value, current: value === s.value }));
    entries.push({ kind: "right" }, { kind: "wrong" });
    if (s.canRestore && s.correction) entries.push({ kind: "restore", feedbackId: s.correction.feedbackId });
    entries.push({ kind: "history" });
    return entries;
}

/** One signal as StarChat's `POST insights/feedback` reads it. `valueFrom` is the value read (null when unset) and is
 * always sent: StarChat refuses a blind write. */
function ask({ conversationId, requestId, field, signal, valueFrom, valueTo, note }) {
    if (!FIELDS.includes(field)) throw new Error("Classifications.ask: " + field + " is not a judgement");
    if (valueFrom === undefined) throw new Error("Classifications.ask: valueFrom is the value read, null when unset");
    const a = { subject: onRequest(field) ? "request" : "call", conversationId };
    if (onRequest(field)) a.requestId = requestId;
    Object.assign(a, { field, signal, valueFrom });
    if (valueTo !== undefined && valueTo !== null) a.valueTo = valueTo;
    if (note) a.note = note;
    return a;
}

function newGestureId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
    return [hex() + hex(), hex(), "4" + hex().slice(1), hex(), hex() + hex() + hex()].join("-");
}

// ---- THE FILTER TABLE ----

const GAP_KEYS = CallInsights.GAP_KEYS;
const CHECK_KEYS = CallInsights.CHECK_KEYS;
const NO_CONVERSATION_KEYS = CallInsights.NO_CONVERSATION_KEYS;
const OUTCOME_LINE_KEYS = CallInsights.OUTCOME_KEYS;

const oneOf = (keys) => (v) => (keys.includes(v) ? v : undefined);
const text = (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
const bool = (v) => (v === "true" ? true : v === "false" ? false : undefined);
const onlyTrue = (v) => (v === "true" ? true : undefined);
const epoch = (v) => (/^\d+$/.test(String(v)) ? Number(v) : undefined);
const list = (read) => (v) => {
    const all = (Array.isArray(v) ? v : [v]).map(read);
    return all.length > 0 && all.every((x) => x !== undefined) ? all : undefined;
};

/**
 * Every filter the conversations list reads from its address: the address key, the search body's field, and how a
 * value is read (a value outside its closed set reads as undefined: not applied, and named). In the order the filter
 * bar shows them.
 */
const ADDRESS_FILTERS = [
    { key: "outcomeLine", body: "outcomeLine", read: oneOf(OUTCOME_LINE_KEYS) },
    { key: "resolution", body: "resolution", read: oneOf(RESOLUTION_KEYS) },
    { key: "message", body: "message", read: oneOf(MESSAGE_KEYS) },
    { key: "booked", body: "booked", read: bool },
    // StarChat refuses `transferred: false` (the carrier writes only true)
    { key: "transferred", body: "transferred", read: onlyTrue },
    { key: "unanswered", body: "hasUnanswered", read: onlyTrue },
    { key: "noConversation", body: "noConversation", read: oneOf(NO_CONVERSATION_KEYS) },
    { key: "topic", body: "topic", read: text },
    { key: "topicLabel", body: "topicLabels", read: list(text) },
    { key: "gap", body: "gap", read: oneOf(GAP_KEYS) },
    { key: "check", body: "check", read: oneOf(CHECK_KEYS) },
    { key: "category", body: "requestCategory", read: text },
    { key: "requestOutcome", body: "requestOutcomes", read: list(oneOf(REQUEST_OUTCOME_KEYS)) },
    { key: "corrected", body: "corrected", read: bool },
];
// the window and the analytics' scope: read like the filters, never shown as one
const ADDRESS_SCOPE = [
    { key: "from", body: "timestampGte", read: epoch },
    { key: "to", body: "timestampLte", read: epoch },
    { key: "counted", body: "counted", read: onlyTrue },
];

/**
 * The search body an address stands for: `body` (the fields to send), `filters` (each filter in force, for its chip),
 * `unknown` (address keys whose value is outside its closed set: not applied).
 */
function searchFromQuery(query) {
    const q = query || {};
    const body = {};
    const filters = [];
    const unknown = [];
    for (const f of [...ADDRESS_SCOPE, ...ADDRESS_FILTERS]) {
        if (q[f.key] === undefined || q[f.key] === null || q[f.key] === "") continue;
        const value = f.read(q[f.key]);
        if (value === undefined) { unknown.push(f.key); continue; }
        body[f.body] = value;
        if (ADDRESS_FILTERS.includes(f)) filters.push({ key: f.key, value });
    }
    // reported in the bar's order: the filters, then the window
    const order = [...ADDRESS_FILTERS, ...ADDRESS_SCOPE].map((f) => f.key);
    unknown.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return { body, filters, unknown };
}

function withoutFilter(query, key) {
    const q = { ...(query || {}) };
    delete q[key];
    return q;
}

/**
 * The counts the analytics show, each with the address key it opens and how its key is checked. Every kind is one of
 * `filterConditions`'s predicates; `counted` makes the list the analytics' own scope (finalised calls, not deleted).
 */
const COUNT_KINDS = {
    outcomeLine: (k) => ({ outcomeLine: oneOf(OUTCOME_LINE_KEYS)(k) }),
    resolution: (k) => ({ resolution: oneOf(RESOLUTION_KEYS)(k) }),
    message: (k) => ({ message: oneOf(MESSAGE_KEYS)(k) }),
    booked: (k) => ({ booked: k === true || k === false ? String(k) : undefined }),
    transferred: (k) => ({ transferred: k === true ? "true" : undefined }),
    unanswered: (k) => ({ unanswered: k === true ? "true" : undefined }),
    noConversation: (k) => ({ noConversation: oneOf(NO_CONVERSATION_KEYS)(k) }),
    topic: (k) => ({ topic: text(k) }),
    topicLabels: (k) => {
        const labels = Array.isArray(k) ? k.map(text) : [];
        return { topicLabel: labels.length > 0 && labels.every(Boolean) ? labels : undefined };
    },
    gap: (k) => ({ gap: oneOf(GAP_KEYS)(k) }),
    check: (k) => ({ check: oneOf(CHECK_KEYS)(k) }),
    requestCategory: (k) => {
        const c = k || {};
        const out = { category: c.category === null ? UNCLASSIFIED : text(c.category) };
        if (c.outcomes !== undefined) out.requestOutcome = list(oneOf(REQUEST_OUTCOME_KEYS))(c.outcomes);
        return out;
    },
};

/**
 * The conversations list of exactly the calls a count counts: the business, the count's window (`{from, to}`, epoch
 * milliseconds, the analytics' `timestampGte`/`timestampLte`), the analytics' scope and the count's filter. Throws on a
 * kind or a key the table does not know, so that no count links to a list that is not its own.
 */
function countLink(businessId, window, kind, key) {
    const of = COUNT_KINDS[kind];
    if (!of) throw new Error("Classifications.countLink: no filter for " + kind);
    const filter = of(key);
    if (Object.values(filter).some((v) => v === undefined)) throw new Error("Classifications.countLink: " + kind + " has no value " + JSON.stringify(key));
    const query = { id: businessId };
    const w = window || {};
    if (w.from != null) query.from = String(w.from);
    if (w.to != null) query.to = String(w.to);
    query.counted = "true";
    return { path: "/conversations", query: { ...query, ...filter } };
}

/**
 * Whether the reader owns the calls of `business` (`{owner}`, as `CallInsights.business` reads it). No StarChat answer
 * says "read-only": an owner's own search returns only its own calls, and a non-owner (an admin, a reseller) reads
 * another owner's business's calls (`ConversationAccess`). A business not read yet is not assumed foreign: the server
 * remains the gate, answering 403 `owner_only`.
 */
function isOwnerOf(business, user) {
    if (!business || !business.owner) return true;
    return !!user && business.owner === user.uid;
}

// ---- clients ----

const ROOT = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/customer";
const INSIGHTS = ROOT + "/insights";
const CONVERSATION = ROOT + "/conversation";

function headers(user) {
    return { headers: { "Content-type": "application/json; charset=UTF-8", auth: user.accessToken } };
}

function query(params) {
    const parts = Object.entries(params || {})
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v));
    return parts.length ? "?" + parts.join("&") : "";
}

const data = (promise) => promise.then((response) => response.data);

export default {
    REQUEST_OUTCOME_KEYS,
    NOT_FULFILLED,
    FIELDS,
    UNCLASSIFIED,
    ADDRESS_FILTERS,
    onRequest,
    valuesOf,
    statusFor,
    historyOf,
    chipState,
    menuEntries,
    ask,
    newGestureId,
    searchFromQuery,
    withoutFilter,
    countLink,
    isOwnerOf,

    // A call's judgements, its requests and their history; null when out of scope (404), `{unavailable}` before
    // StarChat's migrations (503). A non-owner's read is recorded by StarChat as an opening.
    classifications(user, businessId, conversationId) {
        return CallInsights.unwrap(axios.get(INSIGHTS + "/calls/" + encodeURIComponent(conversationId) + "/classifications" +
            query({ businessId }), headers(user)));
    },
    // One signal under `gestureId`: `{feedbackId, status, value, replayed}`. A refusal throws (`CallInsights.refusalOf`:
    // 409 `stale_value` with `current`, 403 codes).
    signal(user, a, gestureId) {
        return data(axios.post(INSIGHTS + "/feedback", { ...a, gestureId }, headers(user)));
    },
    // Up to 500 signals as one gesture, all or nothing: `{gestureId, applied, proposed, items}`.
    bulk(user, asks, gestureId) {
        return data(axios.post(INSIGHTS + "/feedback/bulk", { items: asks, gestureId }, headers(user)));
    },
    revertGesture(user, gestureId) {
        return data(axios.post(INSIGHTS + "/feedback/gestures/" + encodeURIComponent(gestureId) + "/revert", {}, headers(user)));
    },
    revert(user, feedbackId) {
        return data(axios.post(INSIGHTS + "/feedback/" + encodeURIComponent(feedbackId) + "/revert", {}, headers(user)));
    },
    // An admin's decision; `requestId` re-attaches an orphan to a current request of its call.
    apply(user, feedbackId, requestId) {
        return data(axios.post(INSIGHTS + "/feedback/" + encodeURIComponent(feedbackId) + "/apply",
            requestId != null ? { requestId } : {}, headers(user)));
    },
    reject(user, feedbackId) {
        return data(axios.post(INSIGHTS + "/feedback/" + encodeURIComponent(feedbackId) + "/reject", {}, headers(user)));
    },
    // The queues (`{total, asOf, items}`): `status` (comma-separated; StarChat's default proposed and orphaned),
    // `businessId`, `field`, `mine`, `from`, `size`, `asOf`.
    queue(user, { status, businessId, field, mine, from, size, asOf } = {}) {
        return CallInsights.unwrap(axios.get(INSIGHTS + "/feedback" +
            query({ status, mine: mine ? "true" : undefined, businessId, field, from, size, asOf }), headers(user)));
    },
    callerRules(user, businessId, conversationId) {
        return CallInsights.unwrap(axios.get(INSIGHTS + "/caller-rules" + query({ businessId, conversationId }), headers(user)));
    },
    createRule(user, businessId, conversationId, applyToEarlier) {
        return data(axios.post(INSIGHTS + "/caller-rules" + query({ businessId }), { conversationId, applyToEarlier: !!applyToEarlier }, headers(user)));
    },
    deleteRule(user, businessId, caller) {
        return data(axios.delete(INSIGHTS + "/caller-rules" + query({ businessId, caller }), headers(user)));
    },
    // A category's requests over a window (`{timestampGte, timestampLte, plan}`), paged: `{total, calls, asOf, items}`.
    // `category` null is "Da classificare".
    categoryRequests(user, category, window, { businessId, outcome, all, from, size, asOf } = {}) {
        const key = category === null ? UNCLASSIFIED : category;
        return CallInsights.unwrap(axios.post(INSIGHTS + "/categories/" + encodeURIComponent(key) + "/requests" +
            query({ businessId, outcome, all: all ? "true" : undefined, from, size, asOf }), window || {}, headers(user)));
    },
    // The configured categories with their labels in `language`: `{items: [{key, label, active}]}`. PROPOSED to
    // StarChat (brief, gap table): today it answers 404, read as null, and no category chip is drawn.
    categories(user, language) {
        return CallInsights.unwrap(axios.get(INSIGHTS + "/categories" + query({ language }), headers(user)));
    },
    // Who opened the reader's calls: `{total, asOf, items: [{at, event, conversationId, businessId, callStart, role, name}]}`.
    accessLog(user, { businessId, from, size, asOf } = {}) {
        return CallInsights.unwrap(axios.get(CONVERSATION + "/access-log" + query({ businessId, from, size, asOf }), headers(user)));
    },
    // A one-time link to a call's recording, `{url, expiresAt}`; recorded by StarChat for a non-owner.
    audioLink(user, conversationId) {
        return data(axios.post(CONVERSATION + "/audio" + query({ id: conversationId }), {}, headers(user)));
    },
};
