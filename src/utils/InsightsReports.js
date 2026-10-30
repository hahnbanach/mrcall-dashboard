/**
 * The reports' and jobs' rules the dashboard applies to what StarChat answers (docs/briefs/2026-10-24-insights-reports-ux.md,
 * in StarChat): the days of a period in the business's time zone, the periods a request offers, the label of each
 * state, a job's progress and who asked. Pure: no request, no store, so each is pinned by `tests/unit/insightsReports.spec.js`.
 *
 * DAYS. A report's `periodEnd` is the exclusive midnight that ends it in the business's zone (StarChat's
 * `CallInsightsReportPeriods`). Its last day is therefore the day before `periodEnd`, read in that zone, never in the
 * viewer's: printing `periodEnd` itself said one day too many, and in the viewer's zone the wrong day for a viewer
 * abroad (the finding of 2026-10-24, `CallReports.vue:187-191` of v2.2.32).
 */

const DAY_MS = 24 * 3600 * 1000;
const FALLBACK_ZONE = "Europe/Rome";

function validZone(zone) {
    if (typeof zone !== "string" || zone === "") return FALLBACK_ZONE;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: zone });
        return zone;
    } catch {
        return FALLBACK_ZONE;
    }
}

// The calendar day and wall time of an instant in `zone`.
function zonedParts(ms, zone) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: validZone(zone), hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(ms));
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

// The instant of 00:00 of day y-m-d in `zone`. The zone's offset is read at a first guess and once more at the
// result, which settles it across a change of offset (a midnight never falls inside the Italian or any European
// switch, which happens at 02:00 or 03:00).
function zonedMidnight(y, m, d, zone) {
    const utc = Date.UTC(y, m - 1, d);
    const offsetAt = (ms) => {
        const p = zonedParts(ms, zone);
        return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - ms;
    };
    let instant = utc - offsetAt(utc);
    instant = utc - offsetAt(instant);
    return instant;
}

// y-m-d moved by `days` (negative goes back), as a plain calendar.
function addDays({ y, m, d }, days) {
    const t = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

// The last midnight before `now` in `zone`: where the periods a request offers end, so no day is cut in two.
function lastMidnight(now, zone) {
    const p = zonedParts(now, zone);
    return zonedMidnight(p.y, p.m, p.d, zone);
}

// The `days` whole days ending at the last midnight: [from, to) in epoch milliseconds.
function presetInterval(days, now, zone) {
    const today = zonedParts(now, zone);
    const start = addDays(today, -days);
    return { from: zonedMidnight(start.y, start.m, start.d, zone), to: zonedMidnight(today.y, today.m, today.d, zone) };
}

// The days a person picked on a calendar (its first and last day, both included, read as calendar days whatever the
// browser's zone) as [from, to) in the business's zone.
function daysInterval(firstDay, lastDay, zone) {
    const day = (date) => ({ y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() });
    const a = day(firstDay);
    const b = addDays(day(lastDay), 1);
    return { from: zonedMidnight(a.y, a.m, a.d, zone), to: zonedMidnight(b.y, b.m, b.d, zone) };
}

// Whether an instant is 00:00 in `zone`: a period between two such instants is whole days of the business.
function atMidnight(ms, zone) {
    const p = zonedParts(ms, validZone(zone));
    return p.h === 0 && p.mi === 0 && p.s === 0;
}

// The days [periodStart, periodEnd) covers in `zone`, the last one included: the first and last day as dates of the
// locale, and how many days. A period whose bounds are not midnights of the zone (a report asked with UTC bounds,
// before the dashboard asked local ones) is not whole days: its days are its length, and `exact` says so.
function inclusiveDays(periodStart, periodEnd, zone, locale) {
    const z = validZone(zone);
    const format = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: z });
    if (!atMidnight(periodStart, z) || !atMidnight(periodEnd, z)) {
        const instant = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: z });
        return {
            first: instant.format(new Date(periodStart)), last: instant.format(new Date(periodEnd)),
            days: Math.max(1, Math.round((periodEnd - periodStart) / DAY_MS)), exact: true,
        };
    }
    const last = Math.max(periodStart, periodEnd - 1);
    const a = zonedParts(periodStart, z);
    const b = zonedParts(last, z);
    const days = Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY_MS) + 1;
    return { first: format.format(new Date(periodStart)), last: format.format(new Date(last)), days, exact: false };
}

// "1 ott 2026 – 7 ott 2026", or the one date of a one-day period. A period that is not whole days of the business is
// said by its start and end instants, so that no day it does not cover is named (U19c m8: a report stored as
// 2026-03-19 00:00 UTC to 2026-03-21 00:00 UTC read "19 mar 2026 – 21 mar 2026" and ends at 01:00 of the 21st in Rome).
function periodLabel(periodStart, periodEnd, zone, locale) {
    const d = inclusiveDays(periodStart, periodEnd, zone, locale);
    if (d.exact) return d.first + " – " + d.last;
    return d.days <= 1 ? d.first : d.first + " – " + d.last;
}

// A day of the business, for a date StarChat gives as an instant (a job's creation, the next report's arrival).
function dayLabel(ms, zone, locale) {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: validZone(zone) }).format(new Date(ms));
}

function dateTimeLabel(ms, zone, locale) {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: validZone(zone) }).format(new Date(ms));
}

// A calendar date as StarChat writes it ("2026-10-12"), in the locale.
function isoDayLabel(iso, locale) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m) return null;
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])));
}

/*
 * THE STATES, each to its label key under `components.callInsights.status` (the brief's "status labels").
 * A history row (`ReportPageStatus`): done, claimed, failed (retried the next night), budget_exhausted (the night's
 * budget ran out, retried without limit), written_off (three real failures). A cycle with no call is no row of
 * StarChat's: see `historyWithEmptyCycles`.
 */
const REPORT_STATUS = {
    done: "ready",
    claimed: "preparing",
    failed: "retryTomorrow",
    budget_exhausted: "postponed",
    written_off: "failed",
};
const REPORT_STATUSES = Object.keys(REPORT_STATUS);

function reportStatusKey(row) {
    const key = row && REPORT_STATUS[row.status];
    if (!key) throw new Error("InsightsReports.reportStatusKey: unknown status " + (row && row.status));
    return key;
}

// Refused because the business's credit could not pay for the work. A refusal for the reserve kept for calls is not
// "not enough credit" (the credit may well cover the work; it would leave the calls short): its reason is said apart
// (`refusalReason`), as is a work larger than its estimate allowed (`over_ceiling`).
const CREDIT_ERRORS = ["no_credit"];

// A job (`InsightsJobStatus`, with its error and counts): queued, running, done, ceiling_reached, failed, cancelled,
// refused. A report job done with no request wrote nothing: no call to analyse.
function jobStatusKey(job) {
    const status = job && job.status;
    switch (status) {
        case "queued": return "queued";
        case "running": return "preparing";
        case "done":
            return job.kind === "report" && job.counts && job.counts.requests === 0 ? "noCalls" : "ready";
        case "ceiling_reached": return "stoppedCredit";
        case "failed": return "failed";
        case "cancelled": return "cancelled";
        case "refused": return CREDIT_ERRORS.includes(job.error) ? "notRunCredit" : "notRun";
        default: throw new Error("InsightsReports.jobStatusKey: unknown status " + status);
    }
}

// The reason a refused job gives beside its state, as a key under `components.callInsights.admin.reason`, or null.
const REFUSAL_REASONS = ["reserve", "over_ceiling"];
function refusalReason(job) {
    return job && job.status === "refused" && REFUSAL_REASONS.includes(job.error) ? job.error : null;
}

function jobOpen(job) {
    return !!job && (job.status === "queued" || job.status === "running");
}

/*
 * What a recompute or a facts job did with its calls, by StarChat's own outcomes (`RecomputeOutcome`, `FactsOutcome`).
 * Progress is the calls processed, over the calls the estimate counted (a facts job has no estimate, so no total): a
 * call stopped at the job's ceiling was never processed, and is named apart, as are the calls not finalised. Counting
 * the ceiling as done said "200 di 200" beside "Analizzate 120 chiamate su 200" (U19 M10). Null for a job with nothing
 * to count (a report, an estimate still running).
 */
const RECOMPUTE_OUTCOMES = ["written", "reasoned", "skipped", "left", "not_finalised", "conflict", "failed", "ceiling"];
const FACTS_OUTCOMES = ["written", "unchanged", "not_finalised", "conflict"];

function outcomesOf(job) {
    if (!job) return null;
    if (job.kind === "recompute") return RECOMPUTE_OUTCOMES;
    if (job.kind === "facts") return FACTS_OUTCOMES;
    return null;
}

// A session not finalised is not a call as Panoramica counts calls (StarChat's `AnalyticsScope`): progress and result
// count calls without it, and say it apart ("4 chiamate analizzate; 10 sessioni non concluse escluse", U19c m9: the
// row read "14 di 14 chiamate" beside Panoramica's 4 calls of the same days). The estimate's `notFinalised`, else the
// job's own count of them, is taken off its `calls`.
const NOT_FINALISED = "not_finalised";

function jobProgress(job) {
    const outcomes = outcomesOf(job);
    if (!outcomes) return null;
    const counts = job.counts || {};
    const estimated = job.estimate && typeof job.estimate.calls === "number" ? job.estimate.calls : null;
    if (job.kind === "recompute" && estimated === null) return null;
    const notFinalised = job.estimate && typeof job.estimate.notFinalised === "number" ? job.estimate.notFinalised : (counts[NOT_FINALISED] || 0);
    const total = estimated === null ? null : Math.max(0, estimated - notFinalised);
    const processed = outcomes.filter((key) => key !== "ceiling" && key !== NOT_FINALISED).reduce((sum, key) => sum + (counts[key] || 0), 0);
    return {
        processed: total === null ? processed : Math.min(processed, total),
        total,
        written: counts.written || 0,
        notFinalised: counts[NOT_FINALISED] || 0,
        ceiling: counts.ceiling || 0,
    };
}

// What a finished recompute or facts job did, in words: each of its outcomes that has calls, in StarChat's order, never
// an empty result beside "Pronto"; the sessions not finalised come last, said apart from the calls.
function jobResult(job) {
    const outcomes = outcomesOf(job);
    if (!outcomes || jobOpen(job)) return [];
    const counts = job.counts || {};
    return outcomes.filter((key) => key !== NOT_FINALISED && counts[key] > 0).map((key) => ({ key, count: counts[key] }))
        .concat(counts[NOT_FINALISED] > 0 ? [{ key: NOT_FINALISED, count: counts[NOT_FINALISED], apart: true }] : []);
}

/*
 * WHO ASKED, by the role StarChat recorded for the request (`requesterRole`, StarChat U13c): never by an account id,
 * which says nothing to a reader. The reader is "you"; otherwise the owner by the business's contact name, the
 * reseller, MrCall (an admin), or "automatic" for an automatic report (`system`). A role StarChat does not know
 * (`null`: a request written before roles were recorded, or gone) is a dash.
 */
const REQUESTER_ROLES = ["owner", "reseller", "admin", "system"];

function requester(uid, role, { me, business } = {}, requestedByName = null) {
    if (me && typeof uid === "string" && uid !== "" && uid === me) return { kind: "you" };
    // a request recorded before its role was (`requesterRole` null): the business's owner is still known by its uid
    // (U19 m4); any other account has no name the dashboard can read
    if (role == null && business && typeof uid === "string" && uid !== "" && uid === business.owner) {
        return { kind: "owner", name: business.ownerName || null };
    }
    // any other request without its role: the name StarChat gives it (`requestedByName`, on jobs and report rows)
    if (role == null && typeof requestedByName === "string" && requestedByName.trim() !== "") {
        return { kind: "named", name: requestedByName.trim() };
    }
    if (!REQUESTER_ROLES.includes(role)) return null;
    if (role === "owner") return { kind: "owner", name: (business && business.ownerName) || null };
    return { kind: role };
}

// The one label of a requester (`t` the i18n translate function): its words, or a dash.
function requesterLabel(t, item, context) {
    const r = requester(item && item.requestedBy, item && item.requesterRole, context, item && item.requestedByName);
    if (!r) return "—";
    if (r.kind === "named") return r.name;
    if (r.kind === "owner") {
        return r.name ? t("components.callInsights.requester.owner", { name: r.name }) : t("components.callInsights.requester.ownerNoName");
    }
    return t("components.callInsights.requester." + r.kind);
}

// A FREE business's owner is offered no paid work (StarChat answers it `plan_required`): the screens offer the plan
// instead of a button that would be refused.
function freeOwner(role, business) {
    return role === "owner" && !!business && business.subscriptionStatus === "FREE";
}

// The coverage banner of Panoramica: shown when at least 10 managed calls, and at least a tenth of them, have no
// automatic analysis a recomputation would add. The number shown, or null.
function recomputeBanner(outcomes) {
    if (!outcomes) return null;
    const n = outcomes.recomputable || 0;
    const managed = outcomes.callsManaged || 0;
    return n >= 10 && n >= 0.1 * managed ? n : null;
}

// A key that names one request: the same on a retry of it (a double click, a lost answer), a new one for the next.
function newRequestKey() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// A report's base (`calls` analysed, `callsManaged` the calls the assistant managed in the period, absent before
// 2026-10-10), for its page and its history row alike: which sentence to say, and its numbers. An analysed count is
// never said over a smaller managed base ("168 di 38 gestite", U19 M1: the copies of `managedCall` were missing from
// calls before 22 October on test): such a base says nothing true, and the calls analysed are said alone.
function reportBase(content) {
    const c = content || {};
    const analysed = typeof c.calls === "number" ? c.calls : null;
    if (analysed === null) return null;
    if (typeof c.callsManaged !== "number") return { kind: "old", analysed };
    if (c.callsManaged < analysed) return { kind: "analysed", analysed };
    return { kind: "managed", analysed, managed: c.callsManaged };
}

/*
 * A REPORT'S OUTCOME, from the report's own counts (`content.resolution`, by value, as StarChat's
 * `CallInsightsReportBuilder.content` writes them): the four lines of the calls where the caller asked something, over
 * their sum, as the analytics show them (StarChat's docs/briefs/2026-10-24-call-resolution-forwarded.md, "Outcome lines").
 * A report is a document of its days: its lines are its own, never the analytics' of today, which may count calls
 * analysed after it. `caller_left` and `spam_wrong_number` stay outside the base, as in the analytics.
 * The forwarded line is not split by message here: the report's content has no resolution-by-message count to split it
 * with, and borrowing today's analytics for it would put two sources in one line.
 */
const REPORT_OUTCOME_KEYS = ["resolved", "forwarded", "handed_over", "unresolved"];

function percentOf(count, base) {
    return base > 0 ? Math.round((count / base) * 100) : 0;
}

function reportOutcome(content) {
    const r = content && content.resolution;
    if (!r || typeof r !== "object") return null;
    const counts = REPORT_OUTCOME_KEYS.map((key) => (typeof r[key] === "number" ? r[key] : 0));
    const base = counts.reduce((a, b) => a + b, 0);
    if (base === 0) return null;
    return { base, lines: REPORT_OUTCOME_KEYS.map((key, i) => ({ key, count: counts[i], percent: percentOf(counts[i], base) })) };
}

// The words of a label as a reader compares them: case and surrounding spaces aside.
function sameWords(a, b) {
    return String(a).trim().toLocaleLowerCase() === String(b).trim().toLocaleLowerCase();
}

// A report's themes, the most called first (a theme without its count, from a report before counts, last): each with
// its calls, the outcome lines that have calls (in line order), and its labels without one that repeats its name.
function reportThemes(content) {
    const topics = content && Array.isArray(content.topics) ? content.topics : [];
    return topics
        .filter((t) => t && typeof t.topic === "string" && t.topic.trim() !== "")
        .map((t) => {
            const r = t.resolution && typeof t.resolution === "object" ? t.resolution : {};
            return {
                topic: t.topic,
                calls: typeof t.calls === "number" ? t.calls : null,
                new: t.new === true,
                outcome: REPORT_OUTCOME_KEYS.filter((key) => r[key] > 0).map((key) => ({ key, count: r[key] })),
                labels: (Array.isArray(t.labels) ? t.labels : [])
                    .filter((l) => typeof l === "string" && l.trim() !== "" && !sameWords(l, t.topic)),
            };
        })
        .sort((a, b) => (b.calls === null ? -1 : b.calls) - (a.calls === null ? -1 : a.calls));
}

// "Aggiungi la risposta" pre-fills the knowledge base with a caller's question: never for a question about the
// caller's own medical case (StarChat's amendment of 2026-10-26, rule 3: the knowledge base is never pre-filled with a
// clinical answer), never on a gap that needs an integration, whose action is the integration's and which an answer in
// the knowledge base cannot satisfy (the amendment of 2026-10-30, m5), and never for a gap without words.
function answerable(gap) {
    return !!gap && typeof gap.summary === "string" && gap.summary.trim() !== "" && gap.category !== "clinical_advice"
        && gap.group !== "needs_integration";
}

/*
 * A CHANGE against the period before is said only over a previous base of at least MIN_PREVIOUS_BASE calls: over 8
 * calls the KPI read "+24725.0%" (U19 M13), which says nothing about the business. Below it the change is "not
 * available" ("n.d."), shown as such; with nothing to compare (no value before, or 0) there is no change at all.
 * `previousBase` is the calls the previous value is counted over (the previous period's calls for a KPI, the previous
 * calls with a request for an outcome line).
 */
const MIN_PREVIOUS_BASE = 20;

/*
 * `partial`: the previous window holds data for less than its whole length (the business's or the scope's first
 * finalised call falls inside it, StarChat's `previousPartial`, the amendment of 2026-10-30, rule 10): its counts
 * compare a few days against a whole period ("+4550%" on the reseller scope, U19c m18), so the change is "n.d." too, with
 * its own reason (`reason`: "base" or "partial").
 */
function change(current, previous, previousBase, { partial = false } = {}) {
    if (previous == null || current == null) return null;
    if (partial) return { available: false, reason: "partial" };
    if (typeof previousBase === "number" && previousBase < MIN_PREVIOUS_BASE) return { available: false, reason: "base" };
    if (previous === 0) return null;
    return { available: true, value: (current - previous) / previous };
}

// StarChat's word that an answer's (or a row's) previous window is partial: one place reads it.
function previousPartial(answer) {
    return !!answer && answer.previousPartial === true;
}

// The four KPIs' changes against the period before (`analytics/dashboard`, its `previousPeriod`), each over the previous
// period's calls (U19 M13) and "n.d." over a partial previous window (rule 10): the business page's and the admin's.
function kpiChanges(dashboard) {
    const d = dashboard || {};
    const prev = d.previousPeriod;
    if (!prev) return { totalCalls: null, avgDuration: null, totalDuration: null, uniqueCallers: null };
    const opts = { partial: previousPartial(d) };
    const c = (current, previous) => change(current, previous, prev.totalCalls, opts);
    return {
        totalCalls: c(d.totalCalls, prev.totalCalls),
        avgDuration: c(d.avgCallDurationMs, prev.avgCallDurationMs),
        totalDuration: c(d.totalCallDurationMs, prev.totalCallDurationMs),
        uniqueCallers: c(d.uniqueCallers, prev.uniqueCallers),
    };
}

/*
 * "RICHIESTE DEI CHIAMANTI", what the dashboard does to the rows StarChat orders: an example said by two businesses in
 * near-identical words (case, ’ against ', a comma) is one example (U19 m9); and "other", which says least about what
 * to build, comes after the categories it ties with, by the sort in force (m10), the rest of the order StarChat's.
 */
function foldText(text) {
    return String(text || "").normalize("NFKC").replace(/[\u2018\u2019\u02BC`]/g, "'").toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/'/g, "").replace(/\s+/g, " ").trim();
}

function distinctExamples(examples) {
    const seen = new Set();
    return (Array.isArray(examples) ? examples : []).filter((e) => {
        if (!e || typeof e.text !== "string") return false;
        const key = foldText(e.text);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function otherLast(rows, sort) {
    const value = (r) => (sort === "businesses" ? r.businesses : r.score);
    const list = [...rows];
    for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].category !== "other") continue;
        let j = i;
        while (j + 1 < list.length && value(list[j + 1]) === value(list[i])) j++;
        if (j > i) list.splice(j, 0, list.splice(i, 1)[0]);
    }
    return list;
}

/*
 * WHAT A REPORT READS (the amendment of 2026-10-30, rule 1, U19c B1). A report analyses no call: it reads the calls
 * already analysed, so its estimate's `calls` is always 0 (StarChat's report tally sums only its own request) and
 * cannot say "no calls": only StarChat's refusal (`fits: false`, `no_calls`) does. The report estimate carries the
 * period's finalised calls (`finalised`) and, of those, the analysed ones the report reads (`analysed`). Null when the
 * estimate does not carry them (an older StarChat): then nothing is said about them.
 */
function reportReach(estimate) {
    const e = estimate || {};
    if (typeof e.analysed !== "number") return null;
    const notAnalysed = typeof e.finalised === "number" ? Math.max(0, e.finalised - e.analysed) : 0;
    return { analysed: e.analysed, notAnalysed };
}

/*
 * THE CALLS A REPORT LISTS (the amendment of 2026-10-30, rule 2, U19c M1). From content version 5 a report's
 * `flagged_calls` are the calls whose outcome line is not solved, "the calls to call back"; a report of version 4 or
 * lower froze a list that also took solved calls with an unanswered question or a check, and is captioned for what it
 * holds, "the calls to review", so no stored report is mislabelled.
 */
const FLAGGED_CALL_BACK_FROM = 5;

function flaggedCaption(content) {
    const v = content && typeof content.version === "number" ? content.version : 0;
    return v >= FLAGGED_CALL_BACK_FROM ? "callBack" : "review";
}

/*
 * A CATEGORY ROW'S NEXT ACTION (the amendment of 2026-10-30, rule 4, U19c M3), from StarChat's `nextActionKind`:
 * `business_info` and `integration` with the category's own words (`nextAction`); `delegate`, `handled`, `withdrawn`
 * worded here; `unrated` (no request of the row has an outcome yet) and the unclassified row opening their requests.
 * No row is blank: a kind or an action StarChat leaves unsaid opens the requests.
 * `{ text }` for StarChat's words, `{ key, opens }` for a label key and whether it opens the row's requests.
 */
const WORDED_ACTIONS = ["delegate", "handled", "withdrawn"];

function nextAction(row) {
    const r = row || {};
    if (r.category == null || r.unclassified) return { key: "classify", opens: true };
    const kind = r.nextActionKind;
    const own = typeof r.nextAction === "string" && r.nextAction.trim() !== "" ? r.nextAction.trim() : null;
    if ((kind === "business_info" || kind === "integration") && own) return { text: own };
    if (WORDED_ACTIONS.includes(kind)) return { key: kind, opens: false };
    if (kind === "unrated") return { key: "unrated", opens: true };
    return { key: "open", opens: true };
}

/*
 * THE CYCLES WITH NO CALL (the amendment of 2026-10-30, rule 9, as StarChat 2affa35f2 serves it): the history's
 * top-level `emptyCycles` ({from, to}: the automatic cycles since the last report that held no call, and those the
 * page's written reports recorded inside their longer periods) are no rows of
 * StarChat's page, so they never count in its total nor shift its paging. The page shows them as rows ("Nessuna
 * chiamata dal … al …"), placed by date among its reports, on the page whose range of period ends covers them: the
 * first and the last page reach open-ended toward the newest and the oldest. Only when the history is in date order
 * (`sort` periodEnd) and not narrowed to a state or to requested reports, which a cycle with no call is not.
 * `page`: `{offset, size, total, sort, direction, status, type}`. Each such row carries `emptyCycle: true`.
 */
function historyWithEmptyCycles(items, emptyCycles, page) {
    const list = Array.isArray(items) ? items : [];
    const p = page || {};
    // each cycle once: StarChat merges the cycles the page's written reports recorded with the stretch since the last
    // one (2affa35f2), and dedupes them; a repeat is drawn once here too
    const seen = new Set();
    const cycles = (Array.isArray(emptyCycles) ? emptyCycles : [])
        .filter((c) => c && typeof c.from === "number" && typeof c.to === "number")
        .filter((c) => { const k = c.from + ":" + c.to; if (seen.has(k)) return false; seen.add(k); return true; });
    if (cycles.length === 0 || (p.sort || "periodEnd") !== "periodEnd" || p.status || (p.type && p.type !== "automatic")) return list;
    const desc = p.direction !== "asc";
    const first = (p.offset || 0) === 0;
    const last = (p.offset || 0) + (p.size || list.length) >= (p.total || 0);
    // the page's span, from its oldest report's start to its newest's end: a cycle a written report recorded lies
    // inside that report's period
    const newest = list.length ? Math.max(...list.map((r) => r.periodEnd)) : null;
    const oldest = list.length ? Math.min(...list.map((r) => r.periodStart)) : null;
    const reachesNew = desc ? first : last;
    const reachesOld = desc ? last : first;
    const shown = cycles.filter((c) => (reachesNew || (newest !== null && c.to <= newest)) && (reachesOld || (oldest !== null && c.from >= oldest)))
        .map((c) => ({ emptyCycle: true, periodStart: c.from, periodEnd: c.to }));
    if (shown.length === 0) return list;
    return [...list, ...shown].sort((a, b) => (desc ? b.periodEnd - a.periodEnd : a.periodEnd - b.periodEnd));
}

export default {
    FALLBACK_ZONE,
    REPORT_STATUSES,
    reportReach,
    flaggedCaption,
    nextAction,
    historyWithEmptyCycles,
    previousPartial,
    kpiChanges,
    atMidnight,
    distinctExamples,
    otherLast,
    MIN_PREVIOUS_BASE,
    change,
    reportOutcome,
    reportThemes,
    answerable,
    zonedParts,
    zonedMidnight,
    lastMidnight,
    presetInterval,
    daysInterval,
    inclusiveDays,
    periodLabel,
    dayLabel,
    dateTimeLabel,
    isoDayLabel,
    reportStatusKey,
    jobStatusKey,
    refusalReason,
    jobOpen,
    jobProgress,
    jobResult,
    requester,
    requesterLabel,
    freeOwner,
    recomputeBanner,
    newRequestKey,
    reportBase,
    CREDIT_ERRORS,
};
