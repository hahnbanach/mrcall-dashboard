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

// The days [periodStart, periodEnd) covers in `zone`, the last one included: the first and last day as dates of the
// locale, and how many days.
function inclusiveDays(periodStart, periodEnd, zone, locale) {
    const z = validZone(zone);
    const format = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: z });
    const last = Math.max(periodStart, periodEnd - 1);
    const a = zonedParts(periodStart, z);
    const b = zonedParts(last, z);
    const days = Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY_MS) + 1;
    return { first: format.format(new Date(periodStart)), last: format.format(new Date(last)), days };
}

// "1 ott 2026 – 7 ott 2026", or the one date of a one-day period.
function periodLabel(periodStart, periodEnd, zone, locale) {
    const d = inclusiveDays(periodStart, periodEnd, zone, locale);
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
 * budget ran out, retried without limit), written_off (three real failures).
 */
const REPORT_STATUS = {
    done: "ready",
    claimed: "preparing",
    failed: "retryTomorrow",
    budget_exhausted: "postponed",
    written_off: "failed",
};

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

// What a recompute has done of what its estimate counted: every call it went through, whatever became of it, over
// the calls of the interval. Null for a job that has nothing to count yet (a report, an estimate still running).
const RECOMPUTE_OUTCOMES = ["written", "reasoned", "skipped", "left", "not_finalised", "conflict", "failed", "ceiling"];

function jobProgress(job) {
    if (!job || job.kind !== "recompute" || !job.estimate || typeof job.estimate.calls !== "number") return null;
    const counts = job.counts || {};
    const done = RECOMPUTE_OUTCOMES.reduce((sum, key) => sum + (counts[key] || 0), 0);
    return { done: Math.min(done, job.estimate.calls), total: job.estimate.calls, written: counts.written || 0 };
}

/*
 * WHO ASKED, by the role StarChat recorded for the request (`requesterRole`, StarChat U13c): never by an account id,
 * which says nothing to a reader. The reader is "you"; otherwise the owner by the business's contact name, the
 * reseller, MrCall (an admin), or "automatic" for an automatic report (`system`). A role StarChat does not know
 * (`null`: a request written before roles were recorded, or gone) is a dash.
 */
const REQUESTER_ROLES = ["owner", "reseller", "admin", "system"];

function requester(uid, role, { me, business } = {}) {
    if (me && typeof uid === "string" && uid !== "" && uid === me) return { kind: "you" };
    if (!REQUESTER_ROLES.includes(role)) return null;
    if (role === "owner") return { kind: "owner", name: (business && business.ownerName) || null };
    return { kind: role };
}

// The one label of a requester (`t` the i18n translate function): its words, or a dash.
function requesterLabel(t, item, context) {
    const r = requester(item && item.requestedBy, item && item.requesterRole, context);
    if (!r) return "—";
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
// 2026-10-10): which sentence to say, and its numbers.
function reportBase(content) {
    const c = content || {};
    const analysed = typeof c.calls === "number" ? c.calls : null;
    if (analysed === null) return null;
    if (typeof c.callsManaged === "number") return { kind: "managed", analysed, managed: c.callsManaged };
    return { kind: "old", analysed };
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

// "Aggiungi la risposta" pre-fills the knowledge base with the question: never for a question about the caller's own
// medical case (StarChat's amendment of 2026-10-26, rule 3: the knowledge base is never pre-filled with a clinical
// answer), and never for a gap without words.
function answerable(gap) {
    return !!gap && typeof gap.summary === "string" && gap.summary.trim() !== "" && gap.category !== "clinical_advice";
}

export default {
    FALLBACK_ZONE,
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
    requester,
    requesterLabel,
    freeOwner,
    recomputeBanner,
    newRequestKey,
    reportBase,
    CREDIT_ERRORS,
};
