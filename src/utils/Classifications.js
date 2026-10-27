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
// the facts of a call's own record (StarChat `FeedbackField`, 6d13718c6): reported wrong (`fact_wrong`, "Segnala un
// errore"), never corrected; a report changes no value and waits for an admin to close or reject it
const FACT_FIELDS = ["booked", "transferred", "no_conversation", "managed_call", "skill_errors", "unkept"];
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
 * What a signed-in person's signal becomes (StarChat `InsightsFeedback.status`): "wrong" without a value and a fact's
 * report are always proposals; "right" is a confirmation, never the correction in force; a category is applied by an
 * admin and proposed by anyone else; the rest is applied. The dashboard's every reader is a signed-in person: an agent
 * (an API key, a delegated token) never reaches these screens.
 */
function statusFor(field, signal, role) {
    if (signal === "wrong" || signal === "fact_wrong") return "proposed";
    if (signal === "right") return "confirmed";
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

// When an entry last moved: a decision (an admin's apply or reject, a revert) is dated by `decidedAt`, which StarChat
// sets on every decided row; a proposal still waiting only by `createdAt`. An admin applying an old proposal makes it
// the newest correction, whenever it was made.
function movedAt(h) {
    return (h && (h.decidedAt || h.createdAt)) || 0;
}

function newest(list) {
    return list.reduce((best, h) => (!best || movedAt(h) > movedAt(best) ? h : best), null);
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
    // a confirmation is recorded beside the value and is never the correction in force (StarChat 6d13718c6)
    const confirmation = newest(mine.filter((h) => h.status === "confirmed" && h.valueTo === (judgement || {}).value));
    const ownLatest = newest(mine.filter((h) => h.byMe && h.status !== "reverted"));
    // a proposal of the reader still waiting is said first, whatever was decided on its older ones
    const waiting = mine.some((h) => h.byMe && h.status === "proposed");
    let kind = "model";
    if (waiting) kind = "proposed";
    else if (ownLatest && ownLatest.status === "rejected" && (!inForce || movedAt(ownLatest) >= movedAt(inForce))) kind = "rejected";
    else if (inForce && inForce.byMe && statusFor(where.field, inForce.signal, role) === "proposed") kind = "applied";
    else if (inForce) kind = "corrected";
    else if (confirmation) kind = "confirmed";
    // corrected by a gesture made elsewhere (another panel, a list), whose history this reader has not read
    else if (j.corrected === true && j.value !== j.model) kind = "corrected";
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
    // "right" confirms a value: StarChat refuses it on one that is not set (a request not classified yet)
    if (s.value != null) entries.push({ kind: "right" });
    entries.push({ kind: "wrong" });
    if (s.canRestore && s.correction) entries.push({ kind: "restore", feedbackId: s.correction.feedbackId });
    entries.push({ kind: "history" });
    return entries;
}

/** One signal as StarChat's `POST insights/feedback` reads it. `valueFrom` is the value read (null when unset) and is
 * always sent: StarChat refuses a blind write. */
function ask({ conversationId, requestId, field, signal, valueFrom, valueTo, note }) {
    const fact = FACT_FIELDS.includes(field);
    if (!FIELDS.includes(field) && !fact) throw new Error("Classifications.ask: " + field + " is not a judgement nor a fact");
    if (fact !== (signal === "fact_wrong")) throw new Error("Classifications.ask: a fact is reported wrong (fact_wrong), and only a fact is");
    if (valueFrom === undefined) throw new Error("Classifications.ask: valueFrom is the value read, null when unset");
    const a = { subject: onRequest(field) ? "request" : "call", conversationId };
    if (onRequest(field)) a.requestId = requestId;
    Object.assign(a, { field, signal, valueFrom });
    if (valueTo !== undefined && valueTo !== null) a.valueTo = valueTo;
    if (note) a.note = note;
    return a;
}

// ---- a call's judgements from a gesture's answer (StarChat a012b6926), never read again after a gesture ----

/** The judgements a gesture's answer carries (`call`, or one of `calls`), with the history kept: the answer has none. */
function withCallState(data, call) {
    if (!call || typeof call !== "object") return data;
    return { ...call, history: data && Array.isArray(data.history) ? data.history : [] };
}

/**
 * What a gesture wrote, added to the call's history so a chip says it at once (the reader's own: `byMe`, its role, now).
 * `answer` is the signal's answer (`feedbackId`, `status`, `replayed`); a signal already in the history adds nothing.
 */
function withSignal(history, answer, a, gestureId, role, now = Date.now()) {
    const list = Array.isArray(history) ? history : [];
    if (!answer || answer.feedbackId == null || list.some((h) => h.feedbackId === answer.feedbackId)) return list;
    const decided = answer.status === "applied" || answer.status === "confirmed";
    // dated after every row the history holds: the browser's clock may run behind the server's
    const latest = list.reduce((m, h) => Math.max(m, h.createdAt || 0, h.decidedAt || 0), 0);
    const at = Math.max(now, latest + 1);
    const same = (h) => h.field === a.field && (onRequest(a.field) ? h.requestId === a.requestId : h.subject !== "request");
    // an applied correction replaces the one in force on the same judgement, which StarChat marks reverted
    const kept = answer.status === "applied"
        ? list.map((h) => (h.status === "applied" && same(h) ? { ...h, status: "reverted", decidedAt: at } : h))
        : list;
    return kept.concat([{
        feedbackId: answer.feedbackId, subject: a.subject, conversationId: a.conversationId, requestId: a.requestId,
        field: a.field, signal: a.signal, valueFrom: a.valueFrom, valueTo: a.signal === "right" ? a.valueFrom : (a.valueTo != null ? a.valueTo : null),
        source: "person", status: answer.status, actorRole: role, byMe: true, createdAt: at,
        decidedAt: decided ? at : undefined, gestureId,
    }]);
}

/**
 * A gesture made elsewhere (another panel of the call, a list) as `UndoGesture` carries it: the touched calls' state
 * (`calls`) and the signals it wrote (`entries`: `{ask, answer}`), applied to this call's judgements; the same object
 * when the gesture did not touch this call.
 */
function withGesture(data, gesture, now = Date.now()) {
    if (!data || !gesture) return data;
    const mine = (Array.isArray(gesture.calls) ? gesture.calls : []).find((c) => c && c.conversationId === data.conversationId);
    if (!mine) return data;
    let history = Array.isArray(data.history) ? data.history : [];
    for (const e of Array.isArray(gesture.entries) ? gesture.entries : []) {
        if (e && e.ask && e.ask.conversationId === data.conversationId) history = withSignal(history, e.answer, e.ask, gesture.gestureId, gesture.role, now);
    }
    return { ...withCallState(data, mine), history };
}

/**
 * A bulk answer's `items` paired with the asks that wrote them, as `withGesture` takes them. StarChat answers the items
 * grouped by call, not in the order asked, so they are matched by call, field and request.
 */
function bulkEntries(asks, items) {
    const list = Array.isArray(items) ? items : [];
    const key = (x) => [x.conversationId, x.field, x.requestId == null ? "" : x.requestId].join("|");
    const byKey = new Map(list.map((i) => [key(i), i]));
    return (Array.isArray(asks) ? asks : []).map((ask) => ({ ask, answer: byKey.get(key(ask)) })).filter((e) => e.answer);
}

/** The signals an undo reverted (`reverted` ids), marked so in the history. */
function withReverted(history, ids, now = Date.now()) {
    const set = new Set(ids || []);
    return (Array.isArray(history) ? history : []).map((h) => (set.has(h.feedbackId) ? { ...h, status: "reverted", decidedAt: now } : h));
}

/** A decision's answer (the signal as it now stands, with its call's state beside it) put in place in the history. */
function withDecision(history, row) {
    const { call, ...entry } = row || {};
    void call;
    return (Array.isArray(history) ? history : []).map((h) => (h.feedbackId === entry.feedbackId ? { ...h, ...entry } : h));
}

/** The current values a stale-value refusal (409) carries, put in place of the ones read. */
function withCurrent(data, current) {
    if (!data) return data;
    const next = {
        ...data,
        requests: Array.isArray(data.requests) ? data.requests.map((r) => ({ ...r })) : [],
        facts: { ...(data.facts || {}) },
    };
    for (const c of Array.isArray(current) ? current : []) {
        if (FACT_FIELDS.includes(c.field)) next.facts[c.field] = c.value == null ? null : c.value;
        else if (onRequest(c.field)) {
            const r = next.requests.find((x) => x.requestId === c.requestId);
            if (r) r[c.field] = { ...(r[c.field] || {}), value: c.value == null ? null : c.value };
        } else if (next[c.field]) next[c.field] = { ...next[c.field], value: c.value == null ? null : c.value };
    }
    return next;
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
    { key: "unanswered", body: "hasUnanswered", read: bool },
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
 *
 * `report`: the count is frozen into a generated report, never rescoped on read (StarChat's brief, amendment of
 * 2026-10-27): its list asks StarChat how many of the counted calls it leaves out for the reader (`leftOut=true`,
 * StarChat dc4d7f7f6), and says so.
 */
function countLink(businessId, window, kind, key, { report = false } = {}) {
    const of = COUNT_KINDS[kind];
    if (!of) throw new Error("Classifications.countLink: no filter for " + kind);
    const filter = of(key);
    if (Object.values(filter).some((v) => v === undefined)) throw new Error("Classifications.countLink: " + kind + " has no value " + JSON.stringify(key));
    const query = { id: businessId };
    const w = window || {};
    if (w.from != null) query.from = String(w.from);
    if (w.to != null) query.to = String(w.to);
    query.counted = "true";
    const link = { path: "/conversations", query: { ...query, ...filter } };
    if (report) link.query.leftOut = "true";
    return link;
}

/**
 * Whether the reader owns the calls of `business` (`{owner}`, as `CallInsights.business` reads it): true, false, or
 * null while not known. No StarChat answer says "read-only": an owner's own search returns only its own calls, and a
 * non-owner (an admin, a reseller) reads another owner's business's calls (`ConversationAccess`), each read by id
 * recorded and never refused. So a caller waits for a known answer before reading a call or its judgements on its
 * own, and before drawing an owner-only control.
 */
function isOwnerOf(business, user) {
    if (!business || !business.owner || !user || !user.uid) return null;
    return business.owner === user.uid;
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
    FACT_FIELDS,
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
    withCallState,
    withSignal,
    withGesture,
    bulkEntries,
    withReverted,
    withDecision,
    withCurrent,
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
