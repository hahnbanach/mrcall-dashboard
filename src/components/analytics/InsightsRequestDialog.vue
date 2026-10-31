<template>
  <Dialog
    :visible="visible"
    modal
    :header="$t('components.callInsights.request.title.' + mode)"
    :style="{ width: '34rem' }"
    :breakpoints="{ '640px': '96vw' }"
    class="insights-request-dialog insights-ui"
    @update:visible="onVisible"
  >
    <!-- 1. The period, with what it has in common with the reports already there -->
    <section v-if="step === 'period'" class="request-step">
      <fieldset class="request-presets">
        <legend class="request-label">{{ $t("components.callInsights.request.periodLabel") }}</legend>
        <div class="request-preset-buttons">
          <Button
            v-for="days in presets"
            :key="days"
            type="button"
            size="small"
            :outlined="choice !== days"
            :aria-pressed="choice === days ? 'true' : 'false'"
            :label="$t('components.callInsights.request.preset', { days })"
            @click="choosePreset(days)"
          />
          <Button
            type="button" size="small"
            :outlined="choice !== 'custom'"
            :aria-pressed="choice === 'custom' ? 'true' : 'false'"
            :label="$t('components.callInsights.request.custom')"
            @click="choice = 'custom'"
          />
        </div>
        <Calendar
          v-if="choice === 'custom'"
          v-model="customDays"
          selectionMode="range"
          :manualInput="false"
          :maxDate="yesterday"
          :inline="true"
          :aria-label="$t('components.callInsights.request.custom')"
          class="request-calendar"
        />
      </fieldset>
      <p v-if="interval" class="request-selected">{{ selectedText }}</p>
      <p class="request-hint">{{ $t("components.callInsights.request.periodHint") }}</p>

      <div v-if="overlap" class="request-overlap" role="status">
        <p v-if="overlap.identical">{{ $t("components.callInsights.request.overlap.same") }}</p>
        <template v-else>
          <p v-if="overlap.cycle">{{ $t("components.callInsights.request.overlap.cycle") }}</p>
          <p v-if="overlapText">{{ overlapText }}</p>
          <label class="request-check">
            <input v-model="acknowledged" type="checkbox" />
            <span>{{ $t("components.callInsights.request.overlap.acknowledge") }}</span>
          </label>
        </template>
      </div>
      <div class="request-actions">
        <Button type="button" text :label="$t('components.callInsights.request.cancel')" @click="close" />
        <Button
          v-if="overlap && overlap.identical && canRegenerate"
          type="button" outlined
          :label="$t('components.callInsights.request.overlap.regenerateInstead')"
          @click="regenerateIdentical"
        />
        <Button
          type="button"
          :label="$t('components.callInsights.request.continue')"
          :disabled="!interval || checking || (overlap && overlap.identical) || (needsAcknowledge && !acknowledged)"
          :loading="checking"
          @click="checkPeriod"
        />
      </div>
    </section>

    <!-- 2. The estimate, never shown: only that the request is being prepared -->
    <section v-else-if="step === 'estimating'" class="request-step" role="status">
      <ProgressBar mode="indeterminate" class="request-bar" />
      <p>{{ $t("components.callInsights.request.preparing") }}</p>
    </section>

    <!-- 3. The confirmation: the business's credit, no amount -->
    <section v-else-if="step === 'confirm'" class="request-step">
      <p v-if="mode === 'anticipate' && anticipateFrom" class="request-note">
        {{ $t("components.callInsights.request.anticipateCycle", { from: anticipateFrom }) }}
      </p>
      <p v-if="interval && mode !== 'anticipate'" class="request-selected">{{ selectedText }}</p>
      <p v-if="mode === 'regenerate'" class="request-selected">{{ regenerateText }}</p>
      <!-- what a report reads: the calls already analysed, and those of the period left out (the amendment's rule 1) -->
      <template v-if="reach">
        <p class="request-reach">{{ $t("components.callInsights.request.reads", { n: reach.analysed }, reach.analysed) }}</p>
        <p v-if="reach.notAnalysed > 0" class="request-note">{{ $t("components.callInsights.request.leftOut", { n: reach.notAnalysed }, reach.notAnalysed) }}</p>
      </template>
      <p class="request-confirm">
        {{ platformPaid
          ? $t("components.callInsights.request.confirmPlatform")
          : $t("components.callInsights.request.confirm", { business: businessName }) }}
      </p>
      <p v-if="!platformPaid" class="request-note">{{ $t("components.callInsights.request.raceNote") }}</p>
      <label v-if="isAdmin && !freeForMrCall" class="request-check">
        <input v-model="platformPays" type="checkbox" :disabled="submitting" />
        <span>{{ $t("components.callInsights.request.platformPays") }}</span>
      </label>
      <div class="request-actions">
        <Button type="button" text :label="$t('components.callInsights.request.cancel')" :disabled="submitting" @click="close" />
        <Button
          type="button"
          :label="$t('components.callInsights.request.confirmButton')"
          :loading="submitting"
          :disabled="submitting"
          @click="submit"
        />
      </div>
    </section>

    <!-- 4. Progress, and the end -->
    <section v-else-if="step === 'running'" class="request-step">
      <div role="status" aria-live="polite">
        <ProgressBar v-if="!progress" mode="indeterminate" class="request-bar" />
        <ProgressBar v-else :value="progressPercent" :showValue="false" class="request-bar" />
        <p>{{ runningText }}</p>
      </div>
      <p class="request-note">{{ $t("components.callInsights.request.keepOpen") }}</p>
      <p class="request-note">{{ $t(job && job.kind === 'recompute' ? "components.callInsights.request.cancelRecompute" : "components.callInsights.request.cancelReport") }}</p>
      <!-- At the start of the row, never where "Confirm" was: a double click on it closed the dialog (seen in WebKit,
           2026-10-24), and a button there could as well have cancelled the job just created. -->
      <div class="request-actions request-actions-start">
        <Button type="button" outlined severity="secondary" :label="$t('components.callInsights.request.cancelJob')" :loading="cancelling" @click="cancelJob" />
        <Button type="button" :label="$t('components.callInsights.request.close')" @click="close" />
      </div>
    </section>

    <section v-else-if="step === 'result'" class="request-step" role="status">
      <p class="request-result">{{ resultText }}</p>
      <div class="request-actions">
        <router-link v-if="resultLink" :to="resultLink" class="p-button p-component request-link" @click="close">
          {{ $t("components.callInsights.request.openReport") }}
        </router-link>
        <Button type="button" :outlined="!!resultLink" :label="$t('components.callInsights.request.close')" @click="close" />
      </div>
    </section>

    <!-- Refusals, each with its own copy and offers -->
    <section v-else-if="step === 'refused'" class="request-step" role="alert">
      <p class="request-result">{{ refusalText }}</p>
      <p v-if="refusalDetail" class="request-note">{{ refusalDetail }}</p>
      <div class="request-actions">
        <Button
          v-if="canOfferAnalysis"
          type="button" outlined
          :label="$t('components.callInsights.request.title.recompute')"
          @click="offerAnalysis"
        />
        <Button v-if="refusal === 'no_credit' && hasPeriod" type="button" outlined :label="$t('components.callInsights.request.shorter')" @click="tryShorter" />
        <!-- an admin refused for the business's credit can run the same work at MrCall's cost (the U17b review) -->
        <Button
          v-if="(refusal === 'no_credit' || refusal === 'reserve') && isAdmin && !platformPaid"
          type="button" outlined
          :label="$t('components.callInsights.request.platformInstead')"
          @click="runAtPlatformCost"
        />
        <router-link v-if="refusal === 'no_credit' || refusal === 'reserve'" :to="planLink" class="p-button p-component p-button-outlined request-link" @click="close">
          {{ $t("components.callInsights.request.topUp") }}
        </router-link>
        <!-- only when StarChat says the business's automatic top-up is not effective (its estimate's topUpEffective) -->
        <router-link v-if="refusal === 'reserve' && topUpEffective === false" :to="planLink" class="p-button p-component p-button-outlined request-link" @click="close">
          {{ $t("components.callInsights.request.enableTopUp") }}
        </router-link>
        <router-link v-if="refusal === 'job_open'" :to="jobsLink" class="p-button p-component p-button-outlined request-link" @click="close">
          {{ $t("components.callInsights.request.busyOpen") }}
        </router-link>
        <router-link v-if="refusal === 'plan_required'" :to="planLink" class="p-button p-component p-button-outlined request-link" @click="close">
          {{ $t("components.callInsights.free.seePlans") }}
        </router-link>
        <Button type="button" :label="$t('components.callInsights.request.close')" @click="close" />
      </div>
    </section>
  </Dialog>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import InsightsReports from "@/utils/InsightsReports";
import { isSessionEnded } from "@/firebase/session";

const POLL_MS = 1500;
const ESTIMATE_LIMIT_MS = 180000;
const PRESETS = [7, 30, 90];

/**
 * The request dialog (docs/briefs/2026-10-24-insights-reports-ux.md in StarChat, "The request dialog"): a report for a
 * period, a regeneration, a recomputation, "Anticipa" and an admin's re-run, one dialog for all.
 *   1. The period: presets ending at the last midnight in the business's zone, or days picked; then what the period has
 *      in common with the reports there (`reports/overlap`): the same days refused (regeneration is the way), days of
 *      the cycle in progress or of a past report acknowledged before they are read again.
 *   2. A hidden estimate: StarChat estimates as a job, and says whether the work fits and, if not, why; no amount.
 *   3. A confirmation naming the business's credit, no amount, and for a report the analysed calls it reads and the
 *      finalised calls not analysed yet it leaves out; an admin may put the work at MrCall's cost.
 *   4. The job, created under one request key so that a double click or a lost answer is one job, followed to its end,
 *      and cancellable.
 * Each refusal has its own copy (`InsightsRefusal`, the job's error): no credit offers a shorter period and a top-up;
 * the reserve offers a top-up, and switching the automatic top-up on only to a business without one; an estimate
 * stale, used or not matching is estimated again, unseen; another job open names who started it and when.
 */
export default {
  props: {
    visible: { type: Boolean, default: false },
    // report | regenerate | recompute | anticipate | rerun
    mode: { type: String, required: true },
    business: { type: Object, required: true },
    role: { type: String, default: "owner" },
    // the reports a regeneration rewrites: [{periodStart, periodEnd, requestId?}]
    regenerates: { type: Array, default: () => [] },
    // a fixed interval (a recompute of the page's period, a re-run of a written-off period): [from, to)
    fixedInterval: { type: Object, default: null },
    // the business's schedule, for "Anticipa"'s cycle
    schedule: { type: Object, default: null },
  },
  emits: ["update:visible", "started", "ended", "regenerate", "recompute"],
  data() {
    return {
      step: "period",
      choice: 30,
      customDays: null,
      overlap: null,
      acknowledged: false,
      checking: false,
      estimateJob: null,
      requestKey: null,
      platformPays: false,
      submitting: false,
      job: null,
      cancelling: false,
      refusal: null,
      refusalJob: null,
      refusalEstimate: null,
      topUpEffective: null,
      reEstimates: 0,
      now: Date.now(),
    };
  },
  computed: {
    zone() {
      return this.business.timeZone || InsightsReports.FALLBACK_ZONE;
    },
    locale() {
      return this.$i18n.locale;
    },
    isAdmin() {
      return this.role === "admin";
    },
    presets() {
      return PRESETS;
    },
    businessName() {
      return CallInsights.businessLabel(this.business.name, this.business.businessId);
    },
    hasPeriod() {
      return this.mode === "report" || (this.mode === "recompute" && !this.fixedInterval);
    },
    // A reseller's or an admin's work on a FREE business is MrCall's: StarChat makes it platform-paid whatever is asked
    // (InsightsJobs.submit), so the dialog says so and offers no choice.
    freeForMrCall() {
      return this.role !== "owner" && !!this.business && this.business.subscriptionStatus === "FREE";
    },
    platformPaid() {
      return this.freeForMrCall || (this.isAdmin && this.platformPays);
    },
    canRegenerate() {
      return this.mode === "report";
    },
    yesterday() {
      return new Date(InsightsReports.lastMidnight(this.now, this.zone) - 1);
    },
    interval() {
      if (this.fixedInterval) return this.fixedInterval;
      if (!this.hasPeriod) return null;
      if (this.choice === "custom") {
        const days = this.customDays;
        if (!Array.isArray(days) || !days[0]) return null;
        return InsightsReports.daysInterval(days[0], days[1] || days[0], this.zone);
      }
      return InsightsReports.presetInterval(this.choice, this.now, this.zone);
    },
    selectedText() {
      const i = this.interval;
      if (!i) return "";
      const d = InsightsReports.inclusiveDays(i.from, i.to, this.zone, this.locale);
      return this.$t("components.callInsights.request.selected", { from: d.first, to: d.last, days: d.days }, d.days);
    },
    regenerateText() {
      return this.regenerates.map((r) => this.period(r.periodStart, r.periodEnd)).join("; ");
    },
    // The reports the period overlaps: one by its kind and days, several in one sentence with the days they span, never
    // one paragraph each (a 30-day request on a daily cadence printed eight, U19 M11).
    overlapText() {
      const past = (this.overlap && this.overlap.past) || [];
      if (past.length === 0) return null;
      if (past.length === 1) {
        const r = past[0];
        return this.$t("components.callInsights.request.overlap.partial", { kind: this.$t("components.callInsights.request.kind." + r.type), period: this.period(r.periodStart, r.periodEnd) });
      }
      const from = Math.min(...past.map((r) => r.periodStart));
      const to = Math.max(...past.map((r) => r.periodEnd));
      const d = InsightsReports.inclusiveDays(from, to, this.zone, this.locale);
      return this.$t("components.callInsights.request.overlap.partialMany", { n: past.length, from: d.first, to: d.last });
    },
    needsAcknowledge() {
      return !!this.overlap && !this.overlap.identical && (!!this.overlap.cycle || (this.overlap.past || []).length > 0);
    },
    anticipateFrom() {
      const next = this.schedule && this.schedule.nextAutomatic;
      return next ? InsightsReports.dayLabel(next.from, this.zone, this.locale) : null;
    },
    jobKind() {
      return this.mode === "recompute" ? "recompute" : "report";
    },
    // A report's estimate says what the report reads (`InsightsReports.reportReach`); a recompute's says nothing here.
    reach() {
      if (this.jobKind !== "report" || !this.estimateJob) return null;
      return InsightsReports.reportReach(this.estimateJob.estimate);
    },
    progress() {
      return InsightsReports.jobProgress(this.job);
    },
    progressPercent() {
      const p = this.progress;
      return p && p.total > 0 ? Math.round((p.processed / p.total) * 100) : 0;
    },
    runningText() {
      const job = this.job;
      if (!job || job.status === "queued") return this.$t("components.callInsights.request.queued");
      const p = this.progress;
      if (p && p.total !== null) return this.$t("components.callInsights.request.progress", { done: p.processed, total: p.total });
      return this.$t("components.callInsights.request.working");
    },
    resultText() {
      const job = this.job;
      if (!job) return "";
      const key = InsightsReports.jobStatusKey(job);
      if (key === "ready") {
        if (job.kind === "recompute") return this.$t("components.callInsights.request.doneRecompute", { written: (job.counts && job.counts.written) || 0 });
        return this.$t("components.callInsights.request.doneReport");
      }
      if (key === "noCalls") return this.$t("components.callInsights.request.noCalls");
      if (key === "stoppedCredit") {
        const p = InsightsReports.jobProgress(job);
        if (p) return this.$t("components.callInsights.status.recomputeStopped", { done: p.written, total: p.total });
      }
      if (key === "cancelled") return this.$t("components.callInsights.request.cancelled");
      return this.$t("components.callInsights.request.failed");
    },
    resultLink() {
      const job = this.job;
      const reports = job && job.result && Array.isArray(job.result.reports) ? job.result.reports : [];
      if (!reports.length) return null;
      const r = reports[0];
      return { path: "/analytics/report", query: { id: this.business.businessId, start: String(r.periodStart), ...(r.requestId ? { requestId: r.requestId } : {}) } };
    },
    refusalText() {
      switch (this.refusal) {
        case "no_credit": return this.$t("components.callInsights.request.notEnoughCredit");
        // larger than its estimate allowed: the same reason, in the same words, as Processing gives it
        case "over_ceiling": return this.$t("components.callInsights.admin.reason.over_ceiling");
        case "reserve": return this.$t("components.callInsights.request.reserve");
        case "automatic_pending": return this.$t("components.callInsights.request.automaticPending");
        case "report_exists": return this.$t("components.callInsights.request.overlap.same");
        case "retention": return this.$t("components.callInsights.request.retention");
        case "plan_required": return this.$t("components.callInsights.free.paidUnavailable");
        // nothing to read, said before any word about credit (the amendment's rule 5, U19 M7)
        case "no_calls": return this.$t("components.callInsights.request.noCallsPeriod");
        case "no_analysis": {
          const n = this.recomputable;
          return n > 0 ? this.$t("components.callInsights.request.noAnalysis", { n }, n) : this.$t("components.callInsights.request.noAnalysisNone");
        }
        case "cycle_empty": return this.$t("components.callInsights.request.cycleEmpty");
        case "job_open": return this.busyText;
        default: return this.$t("components.callInsights.request.failed");
      }
    },
    // The day of the business's last call, beside "no calls in this period": StarChat's `lastCallAt`, null when the
    // business has had none.
    refusalDetail() {
      const e = this.refusalEstimate;
      if (this.refusal !== "no_calls" || !e || !("lastCallAt" in e)) return null;
      return typeof e.lastCallAt === "number"
        ? this.$t("components.callInsights.request.lastCall", { date: InsightsReports.dayLabel(e.lastCallAt, this.zone, this.locale) })
        : this.$t("components.callInsights.request.noCallEver");
    },
    recomputable() {
      const e = this.refusalEstimate;
      return e && typeof e.recomputable === "number" ? e.recomputable : 0;
    },
    // Their analysis is offered only for calls that can be analysed, and only from a report's own period.
    canOfferAnalysis() {
      return this.refusal === "no_analysis" && this.recomputable > 0 && this.mode === "report" && !!this.interval;
    },
    busyText() {
      const job = this.refusalJob;
      if (!job) return this.$t("components.callInsights.request.busyUnknown");
      const when = InsightsReports.dateTimeLabel(job.createdAt, this.zone, this.locale);
      // "avviata da te", never "da Tu" (U19 m3)
      const me = this.$store.state.user && this.$store.state.user.uid;
      const r = InsightsReports.requester(job.requestedBy, job.requesterRole, { me, business: this.business });
      if (r && r.kind === "you") return this.$t("components.callInsights.request.busyYou", { when });
      return this.$t("components.callInsights.request.busy", { who: this.requesterName(job), when });
    },
    planLink() {
      return { path: "/plan", query: { id: this.business.businessId } };
    },
    jobsLink() {
      return { path: "/analytics", query: { id: this.business.businessId, tab: "jobs" } };
    },
  },
  watch: {
    visible: {
      immediate: true,
      handler(open) {
        if (open) this.start();
        else this.stopPolling();
      },
    },
    choice() {
      this.overlap = null;
      this.acknowledged = false;
    },
    customDays() {
      this.overlap = null;
      this.acknowledged = false;
    },
    // MrCall's cost is one of the work's arguments, which the estimate and its job must share (InsightsJobs.cap): a
    // change of it is estimated again before the job can be created.
    platformPays() {
      if (this.step === "confirm") this.estimate();
    },
  },
  beforeUnmount() {
    this.stopPolling();
  },
  methods: {
    user() {
      return this.$store.state.user;
    },
    period(start, end) {
      return InsightsReports.periodLabel(start, end, this.zone, this.locale);
    },
    requesterName(item) {
      return InsightsReports.requesterLabel(this.$t, item, { me: this.$store.state.user && this.$store.state.user.uid, business: this.business });
    },
    start() {
      this.now = Date.now();
      this.overlap = null;
      this.acknowledged = false;
      this.platformPays = false;
      this.job = null;
      this.refusal = null;
      this.refusalJob = null;
      this.refusalEstimate = null;
      this.reEstimates = 0;
      this.requestKey = null;
      this.choice = 30;
      this.customDays = null;
      if (this.hasPeriod) this.step = "period";
      else this.estimate();
    },
    close() {
      this.stopPolling();
      this.$emit("update:visible", false);
    },
    onVisible(value) {
      if (!value) this.close();
    },
    choosePreset(days) {
      this.choice = days;
    },
    // The period checked against the reports there: only a report has days that can be charged twice.
    checkPeriod() {
      if (!this.interval) return;
      if (this.mode !== "report" || (this.overlap && this.acknowledged)) { this.estimate(); return; }
      this.checking = true;
      CallInsights.overlap(this.user(), this.business.businessId, this.interval.from, this.interval.to)
        .then((answer) => {
          const o = answer && !answer.unavailable ? answer : null;
          const past = o && Array.isArray(o.past) ? o.past : [];
          if (o && (o.identical || o.cycle || past.length > 0)) {
            this.overlap = { identical: o.identical || null, cycle: o.cycle || null, past };
            return;
          }
          this.estimate();
        })
        .catch((error) => this.fail(error))
        .finally(() => { this.checking = false; });
    },
    regenerateIdentical() {
      const r = this.overlap && this.overlap.identical;
      if (r) this.$emit("regenerate", [{ periodStart: r.periodStart, periodEnd: r.periodEnd, requestId: r.requestId || undefined }]);
    },
    tryShorter() {
      const current = typeof this.choice === "number" ? this.choice : 30;
      const shorter = PRESETS.filter((d) => d < current);
      this.choice = shorter.length ? shorter[shorter.length - 1] : PRESETS[0];
      this.refusal = null;
      this.step = "period";
    },
    // What the job asks, beside its estimate: the same arguments for the estimate and for the job.
    work() {
      const body = { businessId: this.business.businessId };
      if (this.mode === "anticipate") body.kind = "automatic_now";
      else if (this.mode === "regenerate") body.regenerates = this.regenerates.map((r) => ({ periodStart: r.periodStart, periodEnd: r.periodEnd, ...(r.requestId ? { requestId: r.requestId } : {}) }));
      else { body.from = this.interval.from; body.to = this.interval.to; }
      if (this.mode === "rerun") body.rerunAutomatic = true;
      // the days already reported, acknowledged (a requested report only: StarChat refuses the option elsewhere)
      if (this.mode === "report" && this.overlap && this.acknowledged) body.acknowledgeOverlap = true;
      // only an admin asks it; on a FREE business StarChat sets it itself for a reseller or an admin
      if (this.isAdmin && this.platformPays) body.platformPays = true;
      return body;
    },
    estimate() {
      this.step = "estimating";
      const body = { ...this.work(), idempotencyKey: InsightsReports.newRequestKey() };
      if (!body.kind) body.kind = this.jobKind;
      this.started = Date.now();
      CallInsights.estimate(this.user(), body)
        .then((job) => this.followEstimate(job))
        .catch((error) => {
          const refusal = CallInsights.refusalOf(error);
          // another estimate of the business is open: the one StarChat names is waited for, then this one asked again
          if (refusal && refusal.code === "estimate_open" && refusal.jobId && this.reEstimates < 2) {
            this.reEstimates++;
            this.waitFor(refusal.jobId, () => this.estimate());
            return;
          }
          // days StarChat finds already reported that the period step did not show: back there, with them
          if (refusal && refusal.code === "overlap_unacknowledged" && this.hasPeriod && this.reEstimates < 2) {
            this.reEstimates++;
            this.overlap = null;
            this.acknowledged = false;
            this.step = "period";
            this.checkPeriod();
            return;
          }
          this.fail(error);
        });
    },
    followEstimate(job) {
      this.estimateJob = job;
      if (InsightsReports.jobOpen(job)) {
        if (Date.now() - this.started > ESTIMATE_LIMIT_MS) { this.showRefusal("failed"); return; }
        this.poll(() => CallInsights.job(this.user(), job.jobId).then((next) => this.followEstimate(next || job)));
        return;
      }
      if (job.status !== "done" || !job.estimate) { this.showRefusal("failed"); return; }
      const e = job.estimate;
      if (e.fits === false) { this.showRefusal(e.reason || "no_credit", e); return; }
      // A report analyses no call, so its estimate's `calls` is always 0: only StarChat's refusal says a report has
      // nothing to read (the amendment of 2026-10-30, rule 1; `calls === 0` refused every report, U19c B1). A
      // recompute's `calls` are the calls it would analyse: none is nothing to do.
      if (this.jobKind === "recompute" && e.calls === 0) {
        this.showRefusal("no_calls");
        return;
      }
      this.requestKey = InsightsReports.newRequestKey();
      this.step = "confirm";
    },
    submit() {
      if (this.submitting || !this.estimateJob) return;
      this.submitting = true;
      const body = { ...this.work(), estimateJobId: this.estimateJob.jobId, idempotencyKey: this.requestKey };
      CallInsights.createJob(this.user(), this.jobKind, body)
        .then((job) => {
          this.job = job;
          this.$emit("started", job);
          this.follow(job);
        })
        .catch((error) => {
          const refusal = CallInsights.refusalOf(error);
          const code = refusal && refusal.code;
          // the estimate went stale, was used by another job, or no longer matches: estimated again, unseen
          if (["estimate_stale", "estimate_used", "estimate_mismatch", "key_conflict"].includes(code) && this.reEstimates < 2) {
            this.reEstimates++;
            this.estimate();
            return;
          }
          if (code === "overlap_unacknowledged") { this.step = "period"; this.checkPeriod(); return; }
          if (code === "job_open") {
            this.refusal = "job_open";
            this.step = "refused";
            if (refusal.jobId) CallInsights.job(this.user(), refusal.jobId).then((j) => { this.refusalJob = j; }).catch(() => {});
            return;
          }
          this.fail(error);
        })
        .finally(() => { this.submitting = false; });
    },
    follow(job) {
      this.job = job;
      if (InsightsReports.jobOpen(job)) {
        this.step = "running";
        this.poll(() => CallInsights.job(this.user(), job.jobId).then((next) => this.follow(next || job)));
        return;
      }
      this.$emit("ended", job);
      if (job.status === "refused") { this.showRefusal(job.error || "failed", job.estimate); return; }
      this.step = "result";
    },
    cancelJob() {
      if (!this.job || this.cancelling) return;
      this.cancelling = true;
      CallInsights.cancelJob(this.user(), this.job.jobId)
        .then((job) => { this.stopPolling(); this.follow(job); })
        .catch((error) => this.fail(error))
        .finally(() => { this.cancelling = false; });
    },
    waitFor(jobId, then) {
      this.poll(() => CallInsights.job(this.user(), jobId).then((j) => {
        if (j && InsightsReports.jobOpen(j)) this.waitFor(jobId, then);
        else then();
      }));
    },
    poll(next) {
      this.stopPolling();
      this.timer = setTimeout(() => {
        this.timer = null;
        if (!this.visible) return;
        next().catch((error) => this.fail(error));
      }, POLL_MS);
    },
    stopPolling() {
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    },
    // `topUpEffective` is StarChat's, from the estimate that was refused (or the job's own estimate): absent, it offers
    // nothing to switch on.
    showRefusal(code, estimate = null) {
      this.refusal = code;
      this.refusalEstimate = estimate;
      this.step = "refused";
      this.topUpEffective = estimate && typeof estimate.topUpEffective === "boolean" ? estimate.topUpEffective : null;
    },
    offerAnalysis() {
      const interval = this.interval;
      this.close();
      this.$emit("recompute", { from: interval.from, to: interval.to });
    },
    runAtPlatformCost() {
      this.refusal = null;
      this.platformPays = true;
      this.estimate();
    },
    fail(error) {
      if (isSessionEnded(error)) { this.close(); return; }
      const refusal = CallInsights.refusalOf(error);
      if (!refusal) console.error("Insights request failed:", error);
      this.showRefusal(refusal ? refusal.code : "failed");
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.request-step {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 14px;
  color: @mrcall_dark_grey_text;

  p {
    margin: 0;
  }
}

.request-presets {
  border: none;
  padding: 0;
  margin: 0;
}

.request-label {
  font-weight: 600;
  margin-bottom: 8px;
}

.request-preset-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.request-calendar {
  margin-top: 10px;
}

.request-selected, .request-reach {
  font-weight: 600;
}

.request-hint, .request-note {
  color: @mrcall_grey_text;
  font-size: 13px;
}

.request-overlap {
  background: @mrcall_light_grey_2;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.request-check {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
}

.request-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.request-actions-start {
  justify-content: flex-start;
}

.request-link {
  text-decoration: none;
}

.request-bar {
  height: 0.4em;
}

.request-result {
  font-weight: 600;
}
</style>
