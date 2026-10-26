<template>
  <section class="analytics-section call-insights-section" aria-labelledby="jobs-title">
    <h3 id="jobs-title" class="section-title">{{ $t("components.callInsights.jobs.title") }}</h3>
    <p class="jobs-purpose">{{ $t("components.callInsights.jobs.purpose") }}</p>
    <div class="jobs-filters">
      <Dropdown
        v-model="kindFilter"
        :options="kindOptions"
        optionLabel="label"
        optionValue="value"
        showClear
        :placeholder="$t('components.callInsights.jobs.filterKind')"
        :ariaLabel="$t('components.callInsights.jobs.filterKind')"
        class="jobs-filter"
      />
      <Dropdown
        v-model="statusFilter"
        :options="statusOptions"
        optionLabel="label"
        optionValue="value"
        showClear
        :placeholder="$t('components.callInsights.reportsTab.filterStatus')"
        :ariaLabel="$t('components.callInsights.reportsTab.filterStatus')"
        class="jobs-filter"
      />
      <Button
        v-if="kindFilter || statusFilter"
        type="button" text size="small" icon="pi pi-times"
        :label="$t('components.callInsights.reportsTab.clearFilters')"
        @click="kindFilter = null; statusFilter = null"
      />
    </div>
    <PagedTable
      :state="jobs"
      :columns="columns"
      :row-key="(row) => row.jobId"
      :caption="$t('components.callInsights.jobs.title')"
      :empty-text="kindFilter || statusFilter ? $t('components.callInsights.jobs.noneFiltered') : $t('components.callInsights.jobs.none')"
    >
      <template #cell-what="{ row }">{{ what(row) }}</template>
      <template #cell-status="{ row }">
        <span>{{ $t("components.callInsights.status." + statusOf(row)) }}</span>
        <span v-if="row.status === 'refused' && row.error === 'automatic_pending'" class="jobs-detail">{{ $t("components.callInsights.request.automaticPending") }}</span>
        <span v-else-if="reasonOf(row)" class="jobs-detail">{{ $t("components.callInsights.admin.reason." + reasonOf(row)) }}</span>
        <span v-else-if="row.status === 'ceiling_reached' && progressOf(row)" class="jobs-detail">
          {{ $t("components.callInsights.status.recomputeStopped", { done: progressOf(row).written, total: progressOf(row).total }) }}
        </span>
      </template>
      <template #cell-progress="{ row }">{{ progressText(row) }}</template>
      <template #cell-requestedBy="{ row }">{{ requesterName(row) }}</template>
      <template #cell-createdAt="{ row }">{{ dateTime(row.createdAt) }}</template>
      <template #cell-result="{ row }">
        <span v-if="resultText(row)" class="jobs-result">{{ resultText(row) }}</span>
        <span class="jobs-actions">
          <router-link
            v-for="(r, i) in reportsOf(row)"
            :key="i"
            :to="reportLink(r)"
            :aria-label="$t('components.callInsights.jobs.openReport', { period: period(r.periodStart, r.periodEnd) })"
          >{{ period(r.periodStart, r.periodEnd) }}</router-link>
          <Button
            v-if="open(row)"
            type="button" text size="small" severity="secondary"
            :label="$t('components.callInsights.request.cancelJob')"
            :title="$t(row.kind === 'recompute' ? 'components.callInsights.request.cancelRecompute' : 'components.callInsights.request.cancelReport')"
            :loading="cancelling === row.jobId"
            @click="cancel(row)"
          />
        </span>
      </template>
    </PagedTable>
  </section>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import InsightsReports from "@/utils/InsightsReports";
import PagedTable from "@/components/analytics/PagedTable.vue";
import { isSessionEnded } from "@/firebase/session";

const POLL_MS = 5000;
// StarChat's job states (`InsightsJobStatus`), in the order of a job's life
const JOB_STATUSES = ["queued", "running", "done", "ceiling_reached", "failed", "cancelled", "refused"];

/**
 * Elaborazioni (docs/briefs/2026-10-24-insights-reports-ux.md in StarChat, "Dashboard"): the business's reports asked,
 * regenerations and recomputations, newest first, server-paged: what each is, its state (with why it did not run), its
 * progress over the calls processed, who asked and when, its result in words or the reports it wrote (each link
 * naming its report), and a cancel while it is open; filtered on the server by kind and state, each filter undone where
 * it is set. The `facts` job (an admin's update of the calls' recorded data) is offered as a filter to an admin only,
 * as StarChat answers it to an admin only. No cost column: StarChat answers none. A page with an open job is read again
 * every few seconds.
 */
export default {
  components: { PagedTable },
  props: {
    business: { type: Object, required: true },
    role: { type: String, default: "owner" },
  },
  data() {
    const user = () => this.$store.state.user;
    return {
      jobs: CallInsights.serverPage(({ offset, size }) => CallInsights.jobs(user(), this.business.businessId, {
        offset, size, kind: this.kindFilter || undefined, status: this.statusFilter || undefined,
      })),
      cancelling: null,
      kindFilter: null,
      statusFilter: null,
    };
  },
  computed: {
    // The kinds a reader can see: the `facts` job is an admin's, and StarChat answers it to an admin only.
    kindOptions() {
      const kinds = ["report", "recompute", "estimate", ...(this.role === "admin" ? ["facts"] : [])];
      return kinds.map((k) => ({ value: k, label: this.$t("components.callInsights.jobs.kinds." + k) }));
    },
    statusOptions() {
      return JOB_STATUSES.map((s) => ({ value: s, label: this.$t("components.callInsights.status." + InsightsReports.jobStatusKey({ status: s })) }));
    },
    zone() {
      return this.business.timeZone || InsightsReports.FALLBACK_ZONE;
    },
    columns() {
      const t = (k) => this.$t("components.callInsights.jobs.columns." + k);
      return [
        { key: "what", label: t("what") },
        { key: "status", label: t("status") },
        { key: "progress", label: t("progress") },
        { key: "requestedBy", label: t("requestedBy") },
        { key: "createdAt", label: t("createdAt") },
        { key: "result", label: t("result") },
      ];
    },
  },
  watch: {
    kindFilter() { this.jobs.refresh(); },
    statusFilter() { this.jobs.refresh(); },
    "jobs.items"(items) {
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      if (items.some(InsightsReports.jobOpen)) this.timer = setTimeout(() => this.jobs.retry(), POLL_MS);
    },
  },
  mounted() {
    this.jobs.refresh();
  },
  beforeUnmount() {
    if (this.timer) clearTimeout(this.timer);
  },
  methods: {
    refresh() {
      this.jobs.refresh();
    },
    open(row) {
      return InsightsReports.jobOpen(row);
    },
    statusOf(row) {
      return InsightsReports.jobStatusKey(row);
    },
    reasonOf(row) {
      return InsightsReports.refusalReason(row);
    },
    progressOf(row) {
      return InsightsReports.jobProgress(row);
    },
    progressText(row) {
      const p = this.progressOf(row);
      if (p && p.total !== null) return this.$t("components.callInsights.jobs.progress", { done: p.processed, total: p.total });
      if (p) return this.$t("components.callInsights.jobs.examined", { n: p.processed }, p.processed);
      if (row.phase === "queued") return this.$t("components.callInsights.status.queued");
      if (row.phase === "estimating" || row.phase === "working") return this.$t("components.callInsights.status.preparing");
      return "–";
    },
    period(from, to) {
      return InsightsReports.periodLabel(from, to, this.zone, this.$i18n.locale);
    },
    what(row) {
      if (row.mode === "automatic_now") return this.$t("components.callInsights.reportsTab.jobAnticipate");
      if (row.mode === "regenerate") {
        const n = Math.max(1, this.reportsOf(row).length);
        return this.$t("components.callInsights.reportsTab.jobRegenerate", { period: this.period(row.from, row.to) }, n);
      }
      if (row.kind === "facts") return this.$t("components.callInsights.reportsTab.jobFacts", { period: this.period(row.from, row.to) });
      if (row.mode === "rerun_automatic") return this.$t("components.callInsights.reportsTab.jobRerun", { period: this.period(row.from, row.to) });
      if (row.kind === "recompute") return this.$t("components.callInsights.reportsTab.jobRecompute", { period: this.period(row.from, row.to) });
      if (row.kind === "estimate") return this.$t("components.callInsights.jobs.estimate");
      return this.$t("components.callInsights.reportsTab.jobReport", { period: this.period(row.from, row.to) });
    },
    // What a finished recompute or facts job did, in words from its counts ("4 analizzate, 10 non concluse").
    resultText(row) {
      const parts = InsightsReports.jobResult(row);
      return parts.map((p) => this.$t("components.callInsights.jobs.outcome." + row.kind + "." + p.key, { n: p.count }, p.count)).join(", ");
    },
    dateTime(ms) {
      return InsightsReports.dateTimeLabel(ms, this.zone, this.$i18n.locale);
    },
    requesterName(item) {
      return InsightsReports.requesterLabel(this.$t, item, { me: this.$store.state.user && this.$store.state.user.uid, business: this.business });
    },
    reportsOf(row) {
      return row.result && Array.isArray(row.result.reports) ? row.result.reports : [];
    },
    reportLink(r) {
      const query = { id: this.business.businessId, start: String(r.periodStart) };
      if (r.requestId) query.requestId = r.requestId;
      return { path: "/analytics/report", query };
    },
    cancel(row) {
      this.cancelling = row.jobId;
      CallInsights.cancelJob(this.$store.state.user, row.jobId)
        .then(() => this.jobs.retry())
        .catch((error) => { if (!isSessionEnded(error)) console.error("Insights job cancel failed:", error); })
        .finally(() => { this.cancelling = null; });
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.jobs-purpose {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: @mrcall_grey_text;
}

.jobs-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.jobs-filter {
  min-width: 12rem;
}

.jobs-result {
  display: block;
  margin-bottom: 4px;
}

.jobs-detail {
  display: block;
  font-size: 12px;
  color: @mrcall_grey_text2;
}

.jobs-actions {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
</style>
