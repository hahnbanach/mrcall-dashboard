<template>
  <div class="reports-tab">
    <!-- the history and jobs are read already; their days are said in the business's zone, so drawn once it is known -->
    <InsightsState v-if="!businessKnown" status="loading" />
    <template v-else>
    <!-- The schedule: how often, the next one, a report held back for credit -->
    <section class="analytics-section call-insights-section reports-schedule" :aria-labelledby="'schedule-title'">
      <h3 id="schedule-title" class="section-title">{{ $t("components.callInsights.reportsTab.scheduleTitle") }}</h3>
      <InsightsState :status="history.status" :empty="!schedule" @retry="history.retry()">
        <div v-if="schedule" class="schedule-panel">
          <template v-if="schedule.cadenceDays > 0">
            <p>{{ $t("components.callInsights.reports.panel.cadence", { days: schedule.cadenceDays }, schedule.cadenceDays) }}</p>
            <p v-if="skipped" class="schedule-skipped" role="status">
              {{ $t("components.callInsights.reports.panel.skipped", { period: skippedPeriod, days: schedule.cadenceDays }, schedule.cadenceDays) }}
            </p>
            <p v-else-if="next">{{ nextText }}</p>
            <!-- a next period longer than the cadence says why: the cycles since `extendedFrom` held no call (rule 9) -->
            <p v-if="!skipped && extendedFrom" class="schedule-hint">{{ $t("components.callInsights.reports.panel.extended", { date: extendedFrom }) }}</p>
            <p class="schedule-hint">
              {{ $t("components.callInsights.reports.panel.settings") }}
              <router-link :to="settingsLink">{{ $t("components.callInsights.reports.panel.settingsLink") }}</router-link>
            </p>
          </template>
          <template v-else>
            <p>{{ $t("components.callInsights.reports.panel.off") }}</p>
            <p class="schedule-hint"><router-link :to="settingsLink">{{ $t("components.callInsights.reports.panel.settingsLink") }}</router-link></p>
          </template>
          <div class="schedule-actions">
            <template v-if="!isFreeOwner">
              <Button type="button" icon="pi pi-plus" :label="$t('components.callInsights.reportsTab.request')" @click="open('report')" />
              <Button
                v-if="canAnticipate"
                type="button" outlined icon="pi pi-forward"
                :label="$t('components.callInsights.reportsTab.anticipate')"
                @click="open('anticipate')"
              />
            </template>
            <p v-else class="schedule-free">
              {{ $t("components.callInsights.free.paidUnavailable") }}
              <router-link :to="planLink">{{ $t("components.callInsights.free.seePlans") }}</router-link>
            </p>
          </div>
        </div>
      </InsightsState>
    </section>

    <!-- Asked recently: the report jobs of the business, as they go -->
    <section v-if="recent.length > 0" class="analytics-section call-insights-section" aria-labelledby="recent-title">
      <h3 id="recent-title" class="section-title">{{ $t("components.callInsights.reportsTab.recentTitle") }}</h3>
      <ul class="recent-strip">
        <li v-for="job in recent" :key="job.jobId" class="recent-card">
          <span class="recent-what">{{ jobWhat(job) }}</span>
          <span class="recent-status">
            {{ $t("components.callInsights.status." + statusOfJob(job)) }}<template v-if="reasonOfJob(job)"> · {{ $t("components.callInsights.admin.reason." + reasonOfJob(job)) }}</template>
          </span>
          <span class="recent-meta">{{ requesterName(job) }} · {{ dateTime(job.createdAt) }}</span>
          <router-link
            v-if="jobReport(job)"
            :to="jobReport(job)"
            class="recent-open"
            :aria-label="$t('components.callInsights.jobs.openReport', { period: jobReportPeriod(job) })"
          >{{ $t("components.callInsights.reportsTab.open") }}</router-link>
        </li>
      </ul>
    </section>

    <!-- The history: every period, its state and who asked, server-paged -->
    <section class="analytics-section call-insights-section" aria-labelledby="history-title">
      <h3 id="history-title" class="section-title">{{ $t("components.callInsights.reportsTab.historyTitle") }}</h3>
      <div class="history-filters">
        <Dropdown
          v-model="statusFilter"
          :options="statusOptions"
          optionLabel="label"
          optionValue="value"
          showClear
          :placeholder="$t('components.callInsights.reportsTab.filterStatus')"
          :ariaLabel="$t('components.callInsights.reportsTab.filterStatus')"
          class="history-filter"
        />
        <Dropdown
          v-model="typeFilter"
          :options="typeOptions"
          optionLabel="label"
          optionValue="value"
          showClear
          :placeholder="$t('components.callInsights.reportsTab.filterType')"
          :ariaLabel="$t('components.callInsights.reportsTab.filterType')"
          class="history-filter"
        />
        <Button
          v-if="statusFilter || typeFilter"
          type="button" text size="small" icon="pi pi-times"
          :label="$t('components.callInsights.reportsTab.clearFilters')"
          @click="statusFilter = null; typeFilter = null"
        />
      </div>
      <PagedTable
        :state="history"
        :rows="historyRows"
        :columns="columns"
        :row-key="rowKey"
        :caption="$t('components.callInsights.reportsTab.historyTitle')"
        :empty-text="statusFilter || typeFilter ? $t('components.callInsights.reportsTab.noneFiltered') : $t('components.callInsights.reportsTab.none')"
      >
        <template #cell-period="{ row }">
          <span v-if="row.emptyCycle" class="history-period history-empty">{{ emptyText(row) }}</span>
          <router-link v-else-if="row.status === 'done'" :to="detailLink(row)" class="history-period">{{ period(row) }}</router-link>
          <span v-else class="history-period">{{ period(row) }}</span>
          <span v-if="!row.emptyCycle" class="history-days">{{ daysText(row) }}</span>
          <!-- a written report longer than its cadence: the quiet stretch it begins with (StarChat's `extendedFrom`) -->
          <span v-if="!row.emptyCycle && typeof row.extendedFrom === 'number'" class="history-days">{{ $t("components.callInsights.reports.history.coveredFrom", { date: day(row.extendedFrom) }) }}</span>
        </template>
        <template #cell-type="{ row }">
          <span v-if="row.emptyCycle">{{ $t("components.callInsights.reports.type.automatic") }}</span>
          <span v-else :title="row.type === 'requested' ? $t('components.callInsights.reports.type.onRequestHelp') : null">
            {{ $t("components.callInsights.reports.type." + row.type) }}
          </span>
        </template>
        <template #cell-revision="{ row }">{{ row.emptyCycle ? "–" : row.revision + 1 }}</template>
        <template #cell-status="{ row }">
          <span v-if="row.emptyCycle" class="history-status">{{ $t("components.callInsights.reports.history.noReport") }}</span>
          <span v-else class="history-status" :class="'status-' + row.status">{{ $t("components.callInsights.status." + statusOf(row)) }}</span>
        </template>
        <template #cell-calls="{ row }">{{ row.emptyCycle ? "0" : callsText(row) }}</template>
        <template #cell-requestedBy="{ row }">{{ row.emptyCycle ? "–" : requesterName(row) }}</template>
        <template #cell-createdAt="{ row }">{{ row.emptyCycle ? "–" : dateTime(row.createdAt) }}</template>
        <template #cell-actions="{ row }">
          <span class="history-actions">
            <router-link v-if="row.status === 'done'" :to="detailLink(row)" class="history-action">{{ $t("components.callInsights.reportsTab.open") }}</router-link>
            <Button
              v-if="row.status === 'done' && !isFreeOwner"
              type="button" text size="small"
              :label="$t('components.callInsights.reportsTab.regenerate')"
              :aria-label="$t('components.callInsights.reportsTab.regenerateOf', { period: period(row) })"
              @click="openRegenerate(row)"
            />
            <Button
              v-if="row.status === 'written_off' && isAdmin"
              type="button" text size="small"
              :label="$t('components.callInsights.reportsTab.rerun')"
              :aria-label="$t('components.callInsights.reportsTab.rerunOf', { period: period(row) })"
              @click="openRerun(row)"
            />
            <Button
              v-if="isAdmin && row.status === 'done'"
              type="button" text size="small" severity="danger"
              :label="$t('components.callInsights.reportsTab.delete')"
              :aria-label="$t('components.callInsights.reportsTab.deleteOf', { period: period(row) })"
              @click="askDelete(row)"
            />
          </span>
        </template>
      </PagedTable>
    </section>

    <InsightsRequestDialog
      v-if="dialogMode"
      v-model:visible="dialogVisible"
      :mode="dialogMode"
      :business="business"
      :role="role"
      :regenerates="dialogRegenerates"
      :fixed-interval="dialogInterval"
      :schedule="schedule"
      @started="onStarted"
      @ended="onEnded"
      @regenerate="openRegenerateRefs"
      @recompute="openRecompute"
    />

    <ReportDeleteDialog
      v-model:visible="deleteVisible"
      :business="business"
      :report="deleting"
      @deleted="onDeleted"
    />
    </template>
  </div>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import InsightsReports from "@/utils/InsightsReports";
import InsightsState from "@/components/analytics/InsightsState.vue";
import PagedTable from "@/components/analytics/PagedTable.vue";
import InsightsRequestDialog from "@/components/analytics/InsightsRequestDialog.vue";
import ReportDeleteDialog from "@/components/analytics/ReportDeleteDialog.vue";

const RECENT_SIZE = 3;
const RECENT_POLL_MS = 5000;

/**
 * The Report tab of a business (docs/briefs/2026-10-24-insights-reports-ux.md in StarChat, "Dashboard"): the schedule
 * panel (the cadence, the next report and what it covers, a report held back for credit), the reports asked recently
 * as they go, and the history: every period with its true days in the business's zone, its type, version, state, its
 * calls over the calls managed, who asked and when, server-paged and sortable, filtered by state and type with each
 * filter undone where it is set. "Richiedi un report", "Anticipa", a regeneration, an admin's re-run and delete open
 * their dialogs. A FREE business's owner is offered the plan instead of paid work.
 */
export default {
  components: { InsightsState, PagedTable, InsightsRequestDialog, ReportDeleteDialog },
  props: {
    // `{businessId}` alone until the page has read the business's record (`businessKnown`): the reads need only the id
    business: { type: Object, required: true },
    businessKnown: { type: Boolean, default: true },
    role: { type: String, default: "owner" },
  },
  emits: ["job-started"],
  data() {
    const user = () => this.$store.state.user;
    return {
      history: CallInsights.serverPage(
        ({ offset, size, asOf, sort, direction }) => CallInsights.reportsPage(user(), this.business.businessId, {
          offset, size, asOf, sort, direction, status: this.statusFilter || undefined, type: this.typeFilter || undefined,
        }),
        { sort: "periodEnd", direction: "desc" },
      ),
      statusFilter: null,
      typeFilter: null,
      recent: [],
      dialogMode: null,
      dialogVisible: false,
      dialogRegenerates: [],
      dialogInterval: null,
      deleteVisible: false,
      deleting: null,
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
    isFreeOwner() {
      return InsightsReports.freeOwner(this.role, this.business);
    },
    schedule() {
      const a = this.history.answer;
      return a && a.schedule ? a.schedule : null;
    },
    next() {
      return this.schedule ? this.schedule.nextAutomatic || null : null;
    },
    // "Anticipa" while an automatic cycle is in progress, not on a retry, and only when StarChat says the cycle holds a
    // finished day (`anticipable`, the amendment's rule 6): an empty cycle would be refused (U19 M8). A server that
    // does not say keeps the offer.
    canAnticipate() {
      const s = this.schedule;
      return !!s && s.cadenceDays > 0 && !!this.next && !this.next.retry && this.next.anticipable !== false;
    },
    // The next automatic report: the day it arrives, StarChat's `arrivesAt` (the first nightly run that will write it,
    // the amendment's rule 7), never the end of its period, which may already be past (U19 M9); and the days it
    // covers, one day said once (m2). Without `arrivesAt` no day is promised.
    nextText() {
      const next = this.next;
      const days = InsightsReports.inclusiveDays(next.from, next.to, this.zone, this.locale);
      const one = days.days <= 1;
      const p = "components.callInsights.reports.panel.";
      if (next.retry) return one ? this.$t(p + "retryOneDay", { day: days.first }) : this.$t(p + "retry", { from: days.first, to: days.last });
      if (typeof next.arrivesAt !== "number") return one ? this.$t(p + "coversOneDay", { day: days.first }) : this.$t(p + "covers", { from: days.first, to: days.last });
      const date = this.day(next.arrivesAt);
      return one ? this.$t(p + "nextOneDay", { date, day: days.first }) : this.$t(p + "next", { date, from: days.first, to: days.last });
    },
    extendedFrom() {
      const n = this.next;
      return n && !n.retry && typeof n.extendedFrom === "number" ? this.day(n.extendedFrom) : null;
    },
    // the page's reports with the cycles that held no call among them (StarChat's `emptyCycles`, outside its total)
    historyRows() {
      const a = this.history.answer;
      return InsightsReports.historyWithEmptyCycles(this.history.items, a && a.emptyCycles, {
        offset: this.history.offset, size: this.history.size, total: this.history.total,
        sort: this.history.sort, direction: this.history.direction, status: this.statusFilter, type: this.typeFilter,
        nextFrom: this.next && typeof this.next.from === "number" ? this.next.from : undefined,
      });
    },
    skipped() {
      return this.schedule ? this.schedule.skippedForCredit || null : null;
    },
    // "Il report di {period} è rimandato": the period the next automatic report would cover, else since the skip.
    skippedPeriod() {
      if (this.next) return InsightsReports.periodLabel(this.next.from, this.next.to, this.zone, this.locale);
      return this.day(this.skipped.since);
    },
    settingsLink() {
      return { path: "/businessconfiguration", query: { id: this.business.businessId, section: "__NOTIFICATIONS__" } };
    },
    planLink() {
      return { path: "/plan", query: { id: this.business.businessId } };
    },
    columns() {
      const t = (k) => this.$t("components.callInsights.reportsTab.columns." + k);
      return [
        { key: "period", label: t("period"), sortKey: "periodEnd" },
        { key: "type", label: t("type") },
        { key: "revision", label: t("revision") },
        { key: "status", label: t("status") },
        { key: "calls", label: t("calls"), sortKey: "calls" },
        { key: "requestedBy", label: t("requestedBy") },
        { key: "createdAt", label: t("createdAt"), sortKey: "createdAt" },
        { key: "actions", label: t("actions") },
      ];
    },
    statusOptions() {
      return InsightsReports.REPORT_STATUSES.map((s) => ({ value: s, label: this.$t("components.callInsights.status." + InsightsReports.reportStatusKey({ status: s })) }));
    },
    typeOptions() {
      return ["automatic", "requested"].map((t) => ({ value: t, label: this.$t("components.callInsights.reports.type." + t) }));
    },
  },
  watch: {
    statusFilter() { this.history.refresh(); },
    typeFilter() { this.history.refresh(); },
  },
  mounted() {
    this.history.refresh();
    this.loadRecent();
  },
  beforeUnmount() {
    if (this.recentTimer) clearTimeout(this.recentTimer);
  },
  methods: {
    day(ms) {
      return InsightsReports.dayLabel(ms, this.zone, this.locale);
    },
    // The days of a row counted from the dates it shows, never StarChat's `days` beside them: a period asked over the
    // API at 01:00 local showed "19 mar – 21 mar · 2 giorni" (U19 m5).
    daysText(row) {
      const n = InsightsReports.inclusiveDays(row.periodStart, row.periodEnd, this.zone, this.locale).days;
      return this.$t("components.callInsights.reportsTab.days", { days: n }, n);
    },
    dateTime(ms) {
      return InsightsReports.dateTimeLabel(ms, this.zone, this.locale);
    },
    period(row) {
      return InsightsReports.periodLabel(row.periodStart, row.periodEnd, this.zone, this.locale);
    },
    // "Nessuna chiamata dal … al …", or of its one day
    emptyText(row) {
      const d = InsightsReports.inclusiveDays(row.periodStart, row.periodEnd, this.zone, this.locale);
      return d.days <= 1 ? this.$t("components.callInsights.reports.history.emptyDay", { day: d.first })
        : this.$t("components.callInsights.reports.history.emptyPeriod", { from: d.first, to: d.last });
    },
    rowKey(row) {
      if (row.emptyCycle) return "empty:" + row.periodStart;
      return row.periodStart + ":" + (row.requestId || "") + ":" + row.revision + ":" + row.status;
    },
    statusOf(row) {
      return InsightsReports.reportStatusKey(row);
    },
    statusOfJob(job) {
      return InsightsReports.jobStatusKey(job);
    },
    reasonOfJob(job) {
      return InsightsReports.refusalReason(job);
    },
    // The row's calls by the same rule as the report's page: never an analysed count over a smaller managed base.
    callsText(row) {
      const base = InsightsReports.reportBase(row);
      if (!base) return "–";
      if (base.kind === "managed") return this.$t("components.callInsights.reportsTab.callsOfManaged", { calls: base.analysed, managed: base.managed });
      return this.$t("components.callInsights.reportsTab.callsAnalysed", { calls: base.analysed });
    },
    requesterName(item) {
      return InsightsReports.requesterLabel(this.$t, item, { me: this.$store.state.user && this.$store.state.user.uid, business: this.business });
    },
    detailLink(row) {
      const query = { id: this.business.businessId, start: String(row.periodStart) };
      if (row.requestId) query.requestId = row.requestId;
      return { path: "/analytics/report", query };
    },
    jobWhat(job) {
      if (job.mode === "automatic_now") return this.$t("components.callInsights.reportsTab.jobAnticipate");
      if (job.mode === "regenerate") {
        const n = Math.max(1, job.result && Array.isArray(job.result.reports) ? job.result.reports.length : 0);
        return this.$t("components.callInsights.reportsTab.jobRegenerate", { period: InsightsReports.periodLabel(job.from, job.to, this.zone, this.locale) }, n);
      }
      if (job.kind === "recompute") return this.$t("components.callInsights.reportsTab.jobRecompute", { period: InsightsReports.periodLabel(job.from, job.to, this.zone, this.locale) });
      return this.$t("components.callInsights.reportsTab.jobReport", { period: InsightsReports.periodLabel(job.from, job.to, this.zone, this.locale) });
    },
    jobReport(job) {
      const reports = job.result && Array.isArray(job.result.reports) ? job.result.reports : [];
      if (!reports.length) return null;
      return this.detailLink({ periodStart: reports[0].periodStart, requestId: reports[0].requestId });
    },
    jobReportPeriod(job) {
      const r = job.result.reports[0];
      return InsightsReports.periodLabel(r.periodStart, r.periodEnd, this.zone, this.locale);
    },
    // The report jobs of the business, newest first, followed while one is open.
    loadRecent() {
      if (this.recentTimer) { clearTimeout(this.recentTimer); this.recentTimer = null; }
      CallInsights.jobs(this.$store.state.user, this.business.businessId, { offset: 0, size: 10 })
        .then((answer) => {
          const items = answer && Array.isArray(answer.items) ? answer.items : [];
          this.recent = items.filter((j) => j.kind === "report").slice(0, RECENT_SIZE);
          if (this.recent.some(InsightsReports.jobOpen)) this.recentTimer = setTimeout(() => this.loadRecent(), RECENT_POLL_MS);
        })
        .catch(() => { this.recent = []; });
    },
    open(mode, { regenerates = [], interval = null } = {}) {
      this.dialogMode = mode;
      this.dialogRegenerates = regenerates;
      this.dialogInterval = interval;
      this.dialogVisible = true;
    },
    openRegenerate(row) {
      this.openRegenerateRefs([{ periodStart: row.periodStart, periodEnd: row.periodEnd, requestId: row.requestId || undefined }]);
    },
    openRegenerateRefs(refs) {
      this.dialogVisible = false;
      this.$nextTick(() => this.open("regenerate", { regenerates: refs }));
    },
    // A report refused for calls not analysed yet offers their analysis, over the same days (the amendment's rule 5).
    openRecompute(interval) {
      this.dialogVisible = false;
      this.$nextTick(() => this.open("recompute", { interval }));
    },
    openRerun(row) {
      this.open("rerun", { interval: { from: row.periodStart, to: row.periodEnd } });
    },
    onStarted(job) {
      this.$emit("job-started", job);
      this.loadRecent();
    },
    onEnded() {
      this.history.refresh();
      this.loadRecent();
    },
    askDelete(row) {
      this.deleting = row;
      this.deleteVisible = true;
    },
    onDeleted() {
      this.history.retry();
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.schedule-panel {
  background: @mrcall_white;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  color: @mrcall_dark_grey_text;

  p {
    margin: 0;
  }
}

.schedule-skipped {
  background: @mrcall_light_grey_2;
  border-left: 4px solid @mrcall_status_warning;
  padding: 8px 10px;
  border-radius: 6px;
}

.schedule-hint, .schedule-free {
  color: @mrcall_grey_text;
  font-size: 13px;
}

.schedule-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

.recent-strip {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.recent-card {
  background: @mrcall_white;
  border: 1px solid @mrcall_borders;
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}

.recent-what {
  font-weight: 600;
  color: @mrcall_dark_grey_text;
}

.recent-status {
  color: @mrcall_dark_grey_text;
}

.recent-meta {
  color: @mrcall_grey_text2;
}

.history-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.history-filter {
  min-width: 200px;
}

.history-period {
  display: block;
  font-weight: 600;
  min-width: 11rem;
}

.history-days {
  font-size: 12px;
  color: @mrcall_grey_text2;
}

.history-status {
  white-space: nowrap;
}

// One action under the other: side by side they made the table wider than its card, and "Rigenera" was cut at its
// right edge (the U17b review).
.history-actions {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  white-space: nowrap;
}

.history-action {
  margin-right: 6px;
}
</style>
