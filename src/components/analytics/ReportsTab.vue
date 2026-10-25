<template>
  <div class="reports-tab">
    <!-- The schedule: how often, the next one, a report held back for credit -->
    <section class="analytics-section call-insights-section reports-schedule" :aria-labelledby="'schedule-title'">
      <h3 id="schedule-title" class="section-title">{{ $t("components.callInsights.reportsTab.scheduleTitle") }}</h3>
      <InsightsState :status="history.status" :empty="!schedule" @retry="history.retry()">
        <div v-if="schedule" class="schedule-panel">
          <template v-if="schedule.cadenceDays > 0">
            <p>{{ $t("components.callInsights.reports.panel.cadence", { days: schedule.cadenceDays }) }}</p>
            <p v-if="skipped" class="schedule-skipped" role="status">
              {{ $t("components.callInsights.reports.panel.skipped", { period: skippedPeriod, days: schedule.cadenceDays }) }}
            </p>
            <p v-else-if="next && next.retry">
              {{ $t("components.callInsights.reports.panel.retry", { from: day(next.from), to: lastDay(next.from, next.to) }) }}
            </p>
            <p v-else-if="next">
              {{ $t("components.callInsights.reports.panel.next", { date: day(next.to), from: day(next.from), to: lastDay(next.from, next.to) }) }}
            </p>
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
                v-if="schedule.cadenceDays > 0 && next && !next.retry"
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
          <router-link v-if="jobReport(job)" :to="jobReport(job)" class="recent-open">{{ $t("components.callInsights.reportsTab.open") }}</router-link>
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
        :columns="columns"
        :row-key="rowKey"
        :caption="$t('components.callInsights.reportsTab.historyTitle')"
        :empty-text="statusFilter || typeFilter ? $t('components.callInsights.reportsTab.noneFiltered') : $t('components.callInsights.reportsTab.none')"
      >
        <template #cell-period="{ row }">
          <router-link v-if="row.status === 'done'" :to="detailLink(row)" class="history-period">{{ period(row) }}</router-link>
          <span v-else class="history-period">{{ period(row) }}</span>
          <span class="history-days">{{ $t("components.callInsights.reportsTab.days", { days: row.days }) }}</span>
        </template>
        <template #cell-type="{ row }">
          <span :title="row.type === 'requested' ? $t('components.callInsights.reports.type.onRequestHelp') : null">
            {{ $t("components.callInsights.reports.type." + row.type) }}
          </span>
        </template>
        <template #cell-revision="{ row }">{{ row.revision + 1 }}</template>
        <template #cell-status="{ row }">
          <span class="history-status" :class="'status-' + row.status">{{ $t("components.callInsights.status." + statusOf(row)) }}</span>
        </template>
        <template #cell-calls="{ row }">{{ callsText(row) }}</template>
        <template #cell-requestedBy="{ row }">{{ requesterName(row) }}</template>
        <template #cell-createdAt="{ row }">{{ dateTime(row.createdAt) }}</template>
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
    />

    <ReportDeleteDialog
      v-model:visible="deleteVisible"
      :business="business"
      :report="deleting"
      @deleted="onDeleted"
    />
  </div>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import InsightsReports from "@/utils/InsightsReports";
import InsightsState from "@/components/analytics/InsightsState.vue";
import PagedTable from "@/components/analytics/PagedTable.vue";
import InsightsRequestDialog from "@/components/analytics/InsightsRequestDialog.vue";
import ReportDeleteDialog from "@/components/analytics/ReportDeleteDialog.vue";

const STATUSES = ["done", "claimed", "failed", "budget_exhausted", "written_off"];
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
    business: { type: Object, required: true },
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
      return STATUSES.map((s) => ({ value: s, label: this.$t("components.callInsights.status." + InsightsReports.reportStatusKey({ status: s })) }));
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
    lastDay(from, to) {
      return InsightsReports.inclusiveDays(from, to, this.zone, this.locale).last;
    },
    dateTime(ms) {
      return InsightsReports.dateTimeLabel(ms, this.zone, this.locale);
    },
    period(row) {
      return InsightsReports.periodLabel(row.periodStart, row.periodEnd, this.zone, this.locale);
    },
    rowKey(row) {
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
    callsText(row) {
      if (typeof row.calls !== "number") return "–";
      if (typeof row.callsManaged === "number") return this.$t("components.callInsights.reportsTab.callsOfManaged", { calls: row.calls, managed: row.callsManaged });
      return this.$t("components.callInsights.reportsTab.callsAnalysed", { calls: row.calls });
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
      if (job.mode === "regenerate") return this.$t("components.callInsights.reportsTab.jobRegenerate");
      if (job.kind === "recompute") return this.$t("components.callInsights.reportsTab.jobRecompute", { period: InsightsReports.periodLabel(job.from, job.to, this.zone, this.locale) });
      return this.$t("components.callInsights.reportsTab.jobReport", { period: InsightsReports.periodLabel(job.from, job.to, this.zone, this.locale) });
    },
    jobReport(job) {
      const reports = job.result && Array.isArray(job.result.reports) ? job.result.reports : [];
      if (!reports.length) return null;
      return this.detailLink({ periodStart: reports[0].periodStart, requestId: reports[0].requestId });
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
