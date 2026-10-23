<template>
  <div style="width: 100%; height: 100%">
    <Toast />
    <ProgressBar
      mode="indeterminate"
      :style="{ height: '0.3em', visibility: anyLoading ? 'visible' : 'hidden' }"
    />
    <div v-if="user" class="analytics-container">

      <!-- Reseller Owner Selector -->
      <OwnerSelector v-if="isReseller" />

      <!-- The filters in force, each undone where it shows (brief outcome 10) -->
      <AnalyticsFilterBar :chips="filterChips" :scope-note="scopeNote" @clear="onClearFilter" />

      <!-- Date Range Controls -->
      <div class="analytics-section">
        <div class="date-controls">
          <SelectButton
            v-model="selectedPreset"
            :options="presetOptions"
            optionLabel="label"
            optionValue="value"
            @change="onPresetChange"
          />
          <Calendar
            style="flex: 1; max-width: 320px;"
            selectionMode="range"
            v-model="rangeValue"
            :manualInput="true"
            :touchUI="true"
            :showIcon="true"
            :showButtonBar="true"
            :placeholder="$t('components.analytics.dateRangePlaceholder')"
          />
        </div>
      </div>

      <!-- KPI Cards -->
      <div v-if="dashboardData" class="analytics-section">
        <h3 class="section-title">{{ $t('components.analytics.overview') }}</h3>
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">{{ $t('components.analytics.kpi.totalCalls') }}</div>
            <div class="kpi-value">{{ formatNumber(dashboardData.totalCalls) }}</div>
            <div v-if="dashboardData.totalCallsDelta != null" class="kpi-delta" :class="deltaClass(dashboardData.totalCallsDelta)">
              <i :class="deltaIcon(dashboardData.totalCallsDelta)"></i>
              {{ formatDeltaPercentage(dashboardData.totalCallsDelta) }}
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">{{ $t('components.analytics.kpi.avgDuration') }}</div>
            <div class="kpi-value">{{ formatDuration(dashboardData.avgCallDurationMs) }}</div>
            <div v-if="dashboardData.avgDurationDelta != null" class="kpi-delta" :class="deltaClass(dashboardData.avgDurationDelta)">
              <i :class="deltaIcon(dashboardData.avgDurationDelta)"></i>
              {{ formatDeltaPercentage(dashboardData.avgDurationDelta) }}
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">{{ $t('components.analytics.kpi.totalDuration') }}</div>
            <div class="kpi-value">{{ formatDuration(dashboardData.totalCallDurationMs) }}</div>
            <div v-if="dashboardData.totalDurationDelta != null" class="kpi-delta" :class="deltaClass(dashboardData.totalDurationDelta)">
              <i :class="deltaIcon(dashboardData.totalDurationDelta)"></i>
              {{ formatDeltaPercentage(dashboardData.totalDurationDelta) }}
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">{{ $t('components.analytics.kpi.uniqueCallers') }}</div>
            <div class="kpi-value">{{ formatNumber(dashboardData.uniqueCallers) }}</div>
            <div v-if="dashboardData.uniqueCallersDelta != null" class="kpi-delta" :class="deltaClass(dashboardData.uniqueCallersDelta)">
              <i :class="deltaIcon(dashboardData.uniqueCallersDelta)"></i>
              {{ formatDeltaPercentage(dashboardData.uniqueCallersDelta) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Time Series Chart -->
      <div v-if="timeseriesData" class="analytics-section">
        <h3 class="section-title">{{ $t('components.analytics.timeseries.title') }}</h3>
        <div class="chart-container">
          <Chart type="line" :data="timeseriesChartData" :options="timeseriesChartOptions" />
        </div>
      </div>

      <!-- Duration Distribution -->
      <div v-if="durationData" class="analytics-section">
        <h3 class="section-title">{{ $t('components.analytics.duration.title') }}</h3>
        <div class="chart-container">
          <Chart type="bar" :data="durationChartData" :options="durationChartOptions" />
        </div>
        <div v-if="durationData.percentiles" class="percentile-stats">
          <div class="stat-item">
            <span class="stat-label">P50</span>
            <span class="stat-value">{{ formatDuration(durationData.percentiles.p50) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">P75</span>
            <span class="stat-value">{{ formatDuration(durationData.percentiles.p75) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">P90</span>
            <span class="stat-value">{{ formatDuration(durationData.percentiles.p90) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">P95</span>
            <span class="stat-value">{{ formatDuration(durationData.percentiles.p95) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">P99</span>
            <span class="stat-value">{{ formatDuration(durationData.percentiles.p99) }}</span>
          </div>
        </div>
      </div>

      <!-- Hourly Heatmap -->
      <div v-if="heatmapData" class="analytics-section">
        <h3 class="section-title">{{ $t('components.analytics.heatmap.title') }}</h3>
        <div class="heatmap-wrapper">
          <div class="heatmap-grid">
            <!-- Header row: hours + total column -->
            <div class="heatmap-cell heatmap-corner"></div>
            <div v-for="h in 24" :key="'hdr-'+h" class="heatmap-cell heatmap-hour-label">{{ h - 1 }}</div>
            <div class="heatmap-cell heatmap-hour-label heatmap-total-label">&Sigma;</div>
            <!-- Day rows -->
            <template v-for="(dayData, dayIndex) in heatmapData.days" :key="'day-'+dayIndex">
              <div class="heatmap-cell heatmap-day-label">{{ $t('components.analytics.heatmap.days.' + dayData.day) }}</div>
              <div
                v-for="(value, hourIndex) in dayData.hours"
                :key="'cell-'+dayIndex+'-'+hourIndex"
                class="heatmap-cell heatmap-value"
                :style="{ backgroundColor: getHeatmapCellColor(value, heatmapMax) }"
                :title="value + ' ' + $t('components.analytics.heatmap.calls')"
              >
                <span v-if="value > 0" class="heatmap-text">{{ value }}</span>
              </div>
              <div class="heatmap-cell heatmap-total-value">{{ heatmapDayTotals[dayIndex] }}</div>
            </template>
            <!-- Totals row -->
            <div class="heatmap-cell heatmap-day-label heatmap-total-label">&Sigma;</div>
            <div
              v-for="(total, hIndex) in heatmapHourTotals"
              :key="'htotal-'+hIndex"
              class="heatmap-cell heatmap-total-value"
            >
              {{ total }}
            </div>
            <div class="heatmap-cell heatmap-total-value heatmap-grand-total">{{ heatmapGrandTotal }}</div>
          </div>
        </div>
      </div>

      <!-- Caller Analytics -->
      <div v-if="callersData" class="analytics-section">
        <h3 class="section-title">{{ $t('components.analytics.callers.title') }}</h3>
        <div v-if="callersData.topCallers && callersData.topCallers.length > 0" class="chart-container">
          <Chart type="bar" :data="callersChartData" :options="callersChartOptions" />
        </div>
        <div v-if="callersData.topCallers && callersData.topCallers.length > 0" class="table-container">
          <DataTable :value="callersData.topCallers" :rows="10" :paginator="callersData.topCallers.length > 10" stripedRows>
            <Column field="number" :header="$t('components.analytics.callers.number')" />
            <Column field="callCount" :header="$t('components.analytics.callers.callCount')" sortable />
            <Column field="totalDuration" :header="$t('components.analytics.callers.totalDuration')" sortable>
              <template #body="slotProps">
                {{ formatDuration(slotProps.data.totalDuration) }}
              </template>
            </Column>
            <Column field="lastCall" :header="$t('components.analytics.callers.lastCall')" sortable>
              <template #body="slotProps">
                {{ formatDate(slotProps.data.lastCall) }}
              </template>
            </Column>
          </DataTable>
        </div>
      </div>

      <!-- How the calls went (brief outcomes 3 and 9): the business page (any role, via its id) or,
           for a reseller with no business chosen, its whole scope -->
      <CallOutcomes v-if="businessId || showScopePage" :status="outcomesStatus" :data="outcomesData" />
      <!-- What the calls were about (brief outcome 9): one business's topics; the scope page, over
           several businesses, says to choose one and never asks -->
      <CallTopics
        v-if="businessId || showScopePage"
        :status="businessId ? topicsStatus : 'needsBusiness'"
        :data="topicsData"
      />
      <CallQuality
        v-if="businessId || showScopePage"
        :status="qualityStatus"
        :data="qualityData"
        :total-calls="outcomesData && outcomesData.totalCalls"
      />

      <!-- Call reports (brief outcome 4): the business page only, those of the period chosen above -->
      <CallReports
        v-if="businessId"
        :status="reportsStatus"
        :reports="reportsData"
        :has-more="reportsHasMore"
        :loading-more="reportsLoadingMore"
        :is-owner="isOwnerRole"
        :is-admin="isAdminRole"
        :business-id="businessId"
        :focus-period="focusReport"
        :focus-request-id="focusRequestId"
        :focused-report="focusedReport"
        @load-more="loadMoreReports"
      />

      <!-- Assistants to review and scope-wide information (brief outcome 5): the reseller's scope
           page only; they ignore the page's date range and owner selector -->
      <AssistantsToReview
        v-if="showScopePage"
        :status="assistantsStatus"
        :data="assistantsData"
        :sort="assistantsSort"
        @sort-change="onAssistantsSortChange"
        @select-business="onAssistantsSelectBusiness"
        @names="rememberNames"
      />
      <ScopeInformation
        v-if="showScopePage"
        :ready="roleReady"
        :template-names="templateNames"
        @names="rememberNames"
        @error="handleApiError"
        @in-view="scopeInView = $event"
      />

      <!-- Empty state -->
      <div v-if="allDataReady && noData && !showScopePage" class="analytics-section">
        <div class="empty-state">
          <i class="pi pi-chart-bar empty-state-icon"></i>
          <h3>{{ $t('components.analytics.emptyState.title') }}</h3>
          <p>{{ $t('components.analytics.emptyState.description') }}</p>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
import { computed } from "vue";
import { useStore } from "vuex";
import { useToast } from "primevue/usetoast";
import router from "@/router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/firebase/config";
import { isSessionEnded } from "@/firebase/axiosConfig";
import AnalyticsApi from "@/utils/Analytics";
import CallInsights from "@/utils/CallInsights";
import TemplatesApi from "@/utils/Templates";
import businessUtils from "@/utils/Business";
import OwnerSelector from "@/components/reseller/OwnerSelector.vue";
import CallOutcomes from "@/components/analytics/CallOutcomes.vue";
import CallTopics from "@/components/analytics/CallTopics.vue";
import CallQuality from "@/components/analytics/CallQuality.vue";
import CallReports from "@/components/analytics/CallReports.vue";
import AssistantsToReview from "@/components/analytics/AssistantsToReview.vue";
import ScopeInformation from "@/components/analytics/ScopeInformation.vue";
import AnalyticsFilterBar from "@/components/analytics/AnalyticsFilterBar.vue";

export default {
  components: { OwnerSelector, CallOutcomes, CallTopics, CallQuality, CallReports, AssistantsToReview, ScopeInformation, AnalyticsFilterBar },
  setup() {
    const store = useStore();
    const toast = useToast();
    return {
      store,
      toast,
      user: computed(() => store.state.user),
      authIsReady: computed(() => store.state.authIsReady),
      isReseller: computed(() => store.state.role === 'reseller'),
      selectedOwnerId: computed(() => store.state.selectedOwnerId),
    };
  },
  data() {
    return {
      router,
      businessId: null,
      rangeValue: null,
      timestampGte: null,
      timestampLte: null,
      selectedPreset: '30d',

      // Data containers
      dashboardData: null,
      timeseriesData: null,
      durationData: null,
      heatmapData: null,
      callersData: null,

      // Loading flags
      loadingDashboard: false,
      loadingTimeseries: false,
      loadingDuration: false,
      loadingHeatmap: false,
      loadingCallers: false,

      // Call insights (brief outcomes 3-5, 9): status is 'loading' | 'ok' | 'absent' | 'unavailable'
      outcomesStatus: "loading",
      outcomesData: null,
      topicsStatus: "loading",
      topicsData: null,
      qualityStatus: "loading",
      qualityData: null,
      reportsStatus: "loading",
      reportsData: [],
      reportsHasMore: false,
      reportsLoadingMore: false,
      assistantsStatus: "loading",
      assistantsData: null,
      assistantsSort: "not_solved",
      // The role is known (see `establishRole`): the scope-wide lists wait for it.
      roleReady: false,
      // businessId -> company name, from every answer that names a business (brief outcome 10)
      businessNames: {},
      // A report a link asked to open (`?report=<periodStart>`, with `&requestId=<id>` for one asked
      // for an interval), and that report when it is not on the first page of the business's reports.
      focusReport: null,
      focusRequestId: null,
      focusedReport: null,
      templateNames: {},
      templatesFetched: false,
      // the scope-wide lists are on screen: the bar says they follow none of its filters
      scopeInView: false,
    };
  },
  computed: {
    // A reseller with no business chosen (the entry a bookmark or the reseller dashboard takes,
    // `ResellerDashboard.vue:87`) reads its whole scope instead of one business.
    showScopePage() {
      return !this.businessId && this.isReseller;
    },
    isOwnerRole() {
      return this.store.state.role === "owner";
    },
    isAdminRole() {
      return this.store.state.role === "admin";
    },
    // Only a reseller or an admin can widen the page past one business; an owner's page is its business.
    canLeaveBusiness() {
      return this.isReseller || this.isAdminRole;
    },
    scopeNote() {
      return this.showScopePage && this.scopeInView ? this.$t("components.callInsights.filterBar.scopeNote") : null;
    },
    filterChips() {
      const chips = [];
      if (this.businessId) {
        chips.push({
          key: "business",
          name: this.$t("components.callInsights.filterBar.business"),
          value: CallInsights.businessLabel(this.businessNames[this.businessId], this.businessId),
          title: this.businessId,
          clearLabel: this.canLeaveBusiness ? this.$t("components.callInsights.filterBar.clearBusiness") : null,
        });
      }
      if (this.isReseller && this.selectedOwnerId) {
        chips.push({
          key: "owner",
          name: this.$t("components.callInsights.filterBar.owner"),
          value: this.ownerLabel(this.selectedOwnerId),
          clearLabel: this.$t("components.callInsights.filterBar.clearOwner"),
        });
      }
      chips.push(this.periodChip());
      return chips;
    },
    anyLoading() {
      return this.loadingDashboard || this.loadingTimeseries || this.loadingDuration ||
        this.loadingHeatmap || this.loadingCallers || this.outcomesStatus === 'loading';
    },
    allDataReady() {
      return !this.anyLoading;
    },
    noData() {
      return !this.dashboardData && !this.timeseriesData && !this.durationData &&
        !this.heatmapData && !this.callersData;
    },
    presetOptions() {
      return [
        { label: this.$t('components.analytics.presets.7d'), value: '7d' },
        { label: this.$t('components.analytics.presets.30d'), value: '30d' },
        { label: this.$t('components.analytics.presets.90d'), value: '90d' },
      ];
    },
    heatmapMax() {
      if (!this.heatmapData || !this.heatmapData.days) return 1;
      let max = 0;
      this.heatmapData.days.forEach(day => {
        day.hours.forEach(v => { if (v > max) max = v; });
      });
      return max || 1;
    },
    heatmapHourTotals() {
      if (!this.heatmapData || !this.heatmapData.days) return [];
      const totals = new Array(24).fill(0);
      this.heatmapData.days.forEach(day => {
        day.hours.forEach((v, i) => { totals[i] += v; });
      });
      return totals;
    },
    heatmapDayTotals() {
      if (!this.heatmapData || !this.heatmapData.days) return [];
      return this.heatmapData.days.map(day => day.hours.reduce((sum, v) => sum + v, 0));
    },
    heatmapGrandTotal() {
      if (!this.heatmapHourTotals.length) return 0;
      return this.heatmapHourTotals.reduce((sum, v) => sum + v, 0);
    },
    timeseriesChartData() {
      if (!this.timeseriesData || !this.timeseriesData.buckets) return { labels: [], datasets: [] };
      return {
        labels: this.timeseriesData.buckets.map(b => b.label),
        datasets: [
          {
            label: this.$t('components.analytics.timeseries.totalCalls'),
            data: this.timeseriesData.buckets.map(b => b.totalCalls),
            borderColor: '#0068FF',
            backgroundColor: 'rgba(0,104,255,0.1)',
            fill: true,
            tension: 0.3,
          },
        ],
      };
    },
    timeseriesChartOptions() {
      return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (context) => {
                return this.$t('components.analytics.timeseries.totalCalls') + ': ' + context.parsed.y;
              },
            },
          },
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      };
    },
    durationChartData() {
      if (!this.durationData || !this.durationData.buckets) return { labels: [], datasets: [] };
      return {
        labels: this.durationData.buckets.map(b => b.label),
        datasets: [{
          label: this.$t('components.analytics.duration.callCount'),
          data: this.durationData.buckets.map(b => b.count),
          backgroundColor: 'rgba(0,104,255,0.6)',
        }],
      };
    },
    durationChartOptions() {
      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      };
    },
    callersChartData() {
      if (!this.callersData || !this.callersData.topCallers || !this.callersData.topCallers.length) return { labels: [], datasets: [] };
      return {
        labels: this.callersData.topCallers.map(c => c.number),
        datasets: [{
          label: this.$t('components.analytics.callers.callCount'),
          data: this.callersData.topCallers.map(c => c.callCount),
          backgroundColor: 'rgba(0,104,255,0.6)',
        }],
      };
    },
    callersChartOptions() {
      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      };
    },
  },
  watch: {
    selectedOwnerId() {
      this.fetchAllData();
    },
    rangeValue(val) {
      // A preset sets the range itself and fetches once; only a range the user picks is handled here
      // (before, every preset and the first load fetched every section twice).
      if (val === this.presetRange) return;
      if (val && val[0] && val[1]) {
        this.selectedPreset = null;
        this.timestampGte = val[0].getTime();
        this.timestampLte = val[1].getTime();
        this.fetchAllData();
      }
    },
    // Moving from the scope page to a business, or back, has no other reactive trigger
    // (`<router-view/>` has no key, `App.vue:14`), so a route change loads the one the link asks for.
    '$route.query'() {
      if (this.$route.name !== 'Analytics') return;
      const id = this.$route.query.id || null;
      const report = this.reportFromRoute();
      const requestId = this.requestIdFromRoute();
      if (id === this.businessId && report === this.focusReport && requestId === this.focusRequestId) return;
      this.focusReport = report;
      this.focusRequestId = requestId;
      this.focusedReport = null;
      if (id === this.businessId) { this.focusOnReport(); return; }
      this.businessId = id;
      this.fetchAllData();
    },
  },
  mounted() {
    this.businessId = this.$route.query.id || null;
    this.focusReport = this.reportFromRoute();
    this.focusRequestId = this.requestIdFromRoute();
    if (!this.store || !this.store.state) {
      return;
    }
    this.setPresetRange('30d');
    const proceed = async () => {
      // The role on the server is the gate; this is only what decides which sections to ask for,
      // before any of them is asked (Business.js:262-275, the same search that already sets it
      // elsewhere in this dashboard).
      await this.establishRole();
      this.roleReady = true;
      this.fetchAllData();
    };
    if (!this.store.state.user) {
      onAuthStateChanged(auth, (user) => {
        if (user && user.emailVerified && !user.isAnonymous) {
          proceed();
        }
      });
    } else if (this.store.state.user.accessToken) {
      proceed();
    }
  },
  methods: {
    async establishRole() {
      const user = this.store.state.user;
      if (!user || !user.accessToken) return;
      try {
        await businessUtils.checkUserHasBusinesses(user, this.store);
      } catch (error) {
        this.handleApiError(error, 'role');
      }
    },
    setPresetRange(preset) {
      const now = new Date();
      let start;
      if (preset === '7d') {
        start = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      } else if (preset === '30d') {
        start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      } else if (preset === '90d') {
        start = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
      }
      this.timestampGte = start.getTime();
      this.timestampLte = now.getTime();
      this.selectedPreset = preset;
      this.rangeValue = [start, now];
      // the reactive array the watcher will receive, to tell this range from one the user picks
      this.presetRange = this.rangeValue;
    },
    onPresetChange(event) {
      if (event.value) {
        this.setPresetRange(event.value);
        this.fetchAllData();
      }
    },
    getGranularity() {
      const diffMs = this.timestampLte - this.timestampGte;
      const diffDays = diffMs / (24 * 3600 * 1000);
      if (diffDays <= 2) return 'hourly';
      if (diffDays <= 30) return 'daily';
      if (diffDays <= 90) return 'weekly';
      return 'monthly';
    },
    buildRequestBody() {
      const body = {
        timestampGte: this.timestampGte,
        timestampLte: this.timestampLte,
        businessId: this.businessId,
      };
      if (this.isReseller && this.selectedOwnerId) {
        body.ownerId = this.selectedOwnerId;
      }
      return body;
    },
    // The plan of an integrations item by its name, not its key (the admin page reads the same list).
    fetchTemplateNames() {
      const user = this.store.state.user;
      if (this.templatesFetched || !user || !user.accessToken) return;
      this.templatesFetched = true;
      TemplatesApi.list(user, this.$i18n.locale)
        .then((response) => {
          const names = {};
          (response.data || []).forEach((t) => { if (t.humanName) names[t.name] = t.humanName; });
          this.templateNames = names;
        })
        .catch((error) => {
          this.templatesFetched = false;
          if (!isSessionEnded(error)) console.warn('Analytics templates:', error);
        });
    },
    reportFromRoute() {
      const value = Number(this.$route.query.report);
      return Number.isFinite(value) && value > 0 ? value : null;
    },
    requestIdFromRoute() {
      const value = this.$route.query.requestId;
      return typeof value === 'string' && value !== '' ? value : null;
    },
    rememberNames(names) {
      this.businessNames = { ...this.businessNames, ...names };
    },
    ownerLabel(uid) {
      if (this.user && uid === this.user.uid) return this.$t("components.reseller.ownerSelector.myAccount");
      const owner = (this.store.state.managedOwners || []).find((o) => o.uid === uid);
      return owner ? (owner.displayName || owner.email || uid) : uid;
    },
    periodChip() {
      const preset = this.selectedPreset;
      const days = { '7d': 7, '30d': 30, '90d': 90 }[preset];
      const value = days
        ? this.$t("components.callInsights.filterBar.lastDays", { days })
        : new Date(this.timestampGte).toLocaleDateString() + " – " + new Date(this.timestampLte).toLocaleDateString();
      return {
        key: "period",
        name: this.$t("components.callInsights.filterBar.period"),
        value,
        clearLabel: preset === '30d' ? null : this.$t("components.callInsights.filterBar.clearPeriod"),
      };
    },
    onClearFilter(key) {
      if (key === "business") {
        // Back to the page the business was chosen from: the reseller's scope page, the admin's own.
        this.router.push(this.isReseller ? { path: '/analytics' } : { path: '/analytics-admin' });
      } else if (key === "owner") {
        this.store.commit('setSelectedOwnerId', null);
      } else if (key === "period") {
        this.setPresetRange('30d');
        this.fetchAllData();
      }
    },
    // A business's own page names it from what the page already read, else asks for the name once.
    fetchBusinessName(user) {
      const id = this.businessId;
      if (!id || this.businessNames[id]) return;
      CallInsights.businessName(user, id)
        .then((name) => { if (name) this.rememberNames({ [id]: name }); })
        .catch((error) => { if (!isSessionEnded(error)) console.warn('Analytics business name:', error); });
    },
    focusOnReport() {
      const user = this.store.state.user;
      if (!this.focusReport || !this.businessId || !user || this.reportsStatus !== 'ok') return;
      const key = CallInsights.reportKey({ periodStart: this.focusReport, requestId: this.focusRequestId });
      if (this.reportsData.some((r) => CallInsights.reportKey(r) === key)) return;
      const periodStart = this.focusReport;
      const requestId = this.focusRequestId;
      CallInsights.report(user, this.businessId, periodStart, requestId)
        .then((report) => {
          if (periodStart !== this.focusReport || requestId !== this.focusRequestId) return;
          if (report && !report.unavailable) this.focusedReport = report;
        })
        .catch((error) => this.handleApiError(error, 'reports'));
    },
    handleApiError(error, section) {
      // The session ended: the interceptor has already sent the person to sign in.
      if (isSessionEnded(error)) return;
      console.error(`Analytics ${section} error:`, error);
      this.toast.add({
        severity: 'error',
        summary: this.$t('components.analytics.errors.title'),
        detail: this.$t('components.analytics.errors.fetchFailed', { section }),
        life: 5000,
      });
    },
    fetchAllData() {
      if (!this.timestampGte || !this.timestampLte) return;
      const user = this.store.state.user;
      if (!user || !user.accessToken) return;
      const granularity = this.getGranularity();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      if (!this.businessId) {
        // the plan names the scope page's integrations show, however the page was reached
        if (this.showScopePage) this.fetchTemplateNames();
        this.fetchScopeInsights(user, granularity, timezone);
        return;
      }

      const request = this.buildRequestBody();
      this.fetchDashboard(user, request);
      this.fetchTimeseries(user, request, granularity, timezone);
      this.fetchDurationDistribution(user, request);
      this.fetchHourlyHeatmap(user, request, timezone);
      this.fetchCallers(user, request);

      this.fetchOutcomes(user, request, granularity, timezone);
      this.fetchTopics(user, request);
      this.fetchQuality(user, request);
      this.reportsData = [];
      this.focusedReport = null;
      this.fetchReports(user, this.businessId, null).then(() => this.focusOnReport());
      this.fetchBusinessName(user);
    },
    // Across the reseller's scope (its own calls and all its managed owners', or one of them
    // through the owner selector): no businessId key, which is StarChat's "every business" the
    // scope allows (`AnalyticsDateRange.businessId` absent) — not the explicit `null` a route
    // without `?id=` would otherwise leave in `this.businessId`.
    buildScopeRequestBody() {
      const body = { timestampGte: this.timestampGte, timestampLte: this.timestampLte };
      if (this.isReseller && this.selectedOwnerId) body.ownerId = this.selectedOwnerId;
      return body;
    },
    fetchScopeInsights(user, granularity, timezone) {
      if (!this.isReseller) return;
      const request = this.buildScopeRequestBody();
      this.fetchOutcomes(user, request, granularity, timezone);
      this.fetchQuality(user, request);
      this.fetchAssistants(user, request);
    },
    // One `CallInsights.latestOnly()` per section, created on first use: plain, not reactive state.
    insightGate(section) {
      if (!this.insightGates) this.insightGates = {};
      if (!this.insightGates[section]) this.insightGates[section] = CallInsights.latestOnly();
      return this.insightGates[section].begin();
    },
    fetchOutcomes(user, request, granularity, timezone) {
      this.outcomesStatus = 'loading';
      const isCurrent = this.insightGate('outcomes');
      CallInsights.outcomes(user, request, granularity, timezone)
        .then((result) => {
          if (!isCurrent()) return;
          if (result === null) { this.outcomesStatus = 'absent'; this.outcomesData = null; }
          else if (result.unavailable) { this.outcomesStatus = 'unavailable'; this.outcomesData = null; }
          else { this.outcomesStatus = 'ok'; this.outcomesData = result; }
        })
        .catch((error) => {
          if (!isCurrent()) return;
          if (isSessionEnded(error)) return;
          this.outcomesStatus = 'absent';
          this.handleApiError(error, 'outcomes');
        });
    },
    // One business only: `fetchAllData` reaches this with `businessId` set, never from the scope page.
    fetchTopics(user, request) {
      this.topicsStatus = 'loading';
      const isCurrent = this.insightGate('topics');
      CallInsights.topics(user, request)
        .then((result) => {
          if (!isCurrent()) return;
          if (result === null) { this.topicsStatus = 'absent'; this.topicsData = null; }
          else if (result.unavailable) { this.topicsStatus = 'unavailable'; this.topicsData = null; }
          else { this.topicsStatus = 'ok'; this.topicsData = result; }
        })
        .catch((error) => {
          if (!isCurrent()) return;
          if (isSessionEnded(error)) return;
          this.topicsStatus = 'absent';
          this.handleApiError(error, 'topics');
        });
    },
    fetchQuality(user, request) {
      this.qualityStatus = 'loading';
      const isCurrent = this.insightGate('quality');
      CallInsights.quality(user, request)
        .then((result) => {
          if (!isCurrent()) return;
          if (result === null) { this.qualityStatus = 'absent'; this.qualityData = null; }
          else if (result.unavailable) { this.qualityStatus = 'unavailable'; this.qualityData = null; }
          else { this.qualityStatus = 'ok'; this.qualityData = result; }
        })
        .catch((error) => {
          if (!isCurrent()) return;
          if (isSessionEnded(error)) return;
          this.qualityStatus = 'absent';
          this.handleApiError(error, 'quality');
        });
    },
    // The reports overlapping the page's period, a page of 10 after `after` (the last report shown, null
    // for the first page); a new period starts again from the first page (`fetchAllData`).
    fetchReports(user, businessId, after) {
      this.reportsStatus = after == null ? 'loading' : this.reportsStatus;
      const isCurrent = this.insightGate('reports');
      return CallInsights.reports(user, businessId, this.timestampGte, this.timestampLte, after, 10)
        .then((result) => {
          if (!isCurrent()) return;
          if (result === null) { this.reportsStatus = 'absent'; this.reportsData = []; this.reportsHasMore = false; }
          else if (result.unavailable) { this.reportsStatus = 'unavailable'; this.reportsData = []; this.reportsHasMore = false; }
          else {
            this.reportsStatus = 'ok';
            this.reportsData = after == null ? result : this.reportsData.concat(result);
            this.reportsHasMore = result.length >= 10;
          }
        })
        .catch((error) => {
          if (!isCurrent()) return;
          if (isSessionEnded(error)) return;
          // an earlier page that fails leaves the reports already shown, and the button to try again
          if (after == null) this.reportsStatus = 'absent';
          this.handleApiError(error, 'reports');
        });
    },
    loadMoreReports() {
      if (this.reportsLoadingMore || this.reportsData.length === 0) return;
      const user = this.store.state.user;
      if (!user) return;
      this.reportsLoadingMore = true;
      const last = this.reportsData[this.reportsData.length - 1];
      this.fetchReports(user, this.businessId, last).finally(() => { this.reportsLoadingMore = false; });
    },
    fetchAssistants(user, request) {
      this.assistantsStatus = 'loading';
      const isCurrent = this.insightGate('assistants');
      CallInsights.assistants(user, request, this.assistantsSort, 50)
        .then((result) => {
          if (!isCurrent()) return;
          if (result === null) { this.assistantsStatus = 'absent'; this.assistantsData = null; }
          else if (result.unavailable) { this.assistantsStatus = 'unavailable'; this.assistantsData = null; }
          else { this.assistantsStatus = 'ok'; this.assistantsData = result; }
        })
        .catch((error) => {
          if (!isCurrent()) return;
          if (isSessionEnded(error)) return;
          this.assistantsStatus = 'absent';
          this.handleApiError(error, 'assistants');
        });
    },
    onAssistantsSortChange(sort) {
      this.assistantsSort = sort;
      const user = this.store.state.user;
      if (user) this.fetchAssistants(user, this.buildScopeRequestBody());
    },
    onAssistantsSelectBusiness(businessId) {
      // A reseller's row opens the business page, the same way a link from the clinic's own email would;
      // the filter bar there leads back.
      this.router.push({ path: '/analytics', query: { id: businessId } });
    },
    fetchDashboard(user, request) {
      this.loadingDashboard = true;
      AnalyticsApi.dashboard(user, request)
        .then(response => { this.dashboardData = this.transformDashboard(response.data); })
        .catch(error => { this.handleApiError(error, 'dashboard'); })
        .finally(() => { this.loadingDashboard = false; });
    },
    fetchTimeseries(user, request, granularity, timezone) {
      this.loadingTimeseries = true;
      AnalyticsApi.timeseries(user, request, granularity, timezone)
        .then(response => { this.timeseriesData = this.transformTimeseries(response.data); })
        .catch(error => { this.handleApiError(error, 'timeseries'); })
        .finally(() => { this.loadingTimeseries = false; });
    },
    fetchDurationDistribution(user, request) {
      this.loadingDuration = true;
      AnalyticsApi.durationDistribution(user, request)
        .then(response => { this.durationData = this.transformDuration(response.data); })
        .catch(error => { this.handleApiError(error, 'duration'); })
        .finally(() => { this.loadingDuration = false; });
    },
    fetchHourlyHeatmap(user, request, timezone) {
      this.loadingHeatmap = true;
      AnalyticsApi.hourlyHeatmap(user, request, timezone)
        .then(response => { this.heatmapData = this.transformHeatmap(response.data); })
        .catch(error => { this.handleApiError(error, 'heatmap'); })
        .finally(() => { this.loadingHeatmap = false; });
    },
    fetchCallers(user, request) {
      this.loadingCallers = true;
      AnalyticsApi.callers(user, request, 20)
        .then(response => { this.callersData = this.transformCallers(response.data); })
        .catch(error => { this.handleApiError(error, 'callers'); })
        .finally(() => { this.loadingCallers = false; });
    },
    getHeatmapCellColor(value, max) {
      if (!value || value === 0) return 'transparent';
      const intensity = value / max;
      return `rgba(0, 104, 255, ${0.15 + intensity * 0.75})`;
    },
    computeDelta(current, previous) {
      if (previous == null || previous === 0 || current == null) return null;
      return (current - previous) / previous;
    },
    deltaClass(delta) {
      if (delta > 0) return 'delta-positive';
      if (delta < 0) return 'delta-negative';
      return 'delta-neutral';
    },
    deltaIcon(delta) {
      if (delta > 0) return 'pi pi-arrow-up';
      if (delta < 0) return 'pi pi-arrow-down';
      return 'pi pi-minus';
    },
    formatNumber(n) {
      if (n == null) return '-';
      return n.toLocaleString();
    },
    formatDeltaPercentage(n) {
      if (n == null) return '-';
      return (n * 100).toFixed(1) + '%';
    },
    formatDuration(ms) {
      if (ms == null) return '-';
      if (ms < 1000) return ms + 'ms';
      const secs = Math.round(ms / 1000);
      if (secs < 60) return secs + 's';
      const mins = Math.floor(secs / 60);
      const remainSecs = secs % 60;
      if (mins < 60) return mins + 'm ' + remainSecs + 's';
      const hours = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return hours + 'h ' + remainMins + 'm';
    },
    formatDate(ts) {
      if (!ts) return '-';
      return new Date(ts).toLocaleDateString();
    },
    formatBucketLabel(timestamp) {
      if (!timestamp) return '';
      return new Date(timestamp).toLocaleDateString();
    },
    // --- Backend → Frontend transformations ---
    transformDashboard(data) {
      if (!data) return data;
      const prev = data.previousPeriod;
      return {
        ...data,
        totalCallsDelta: prev ? this.computeDelta(data.totalCalls, prev.totalCalls) : null,
        avgDurationDelta: prev ? this.computeDelta(data.avgCallDurationMs, prev.avgCallDurationMs) : null,
        totalDurationDelta: prev ? this.computeDelta(data.totalCallDurationMs, prev.totalCallDurationMs) : null,
        uniqueCallersDelta: prev ? this.computeDelta(data.uniqueCallers, prev.uniqueCallers) : null,
      };
    },
    transformTimeseries(data) {
      if (!data) return data;
      const buckets = data.buckets || [];
      return {
        ...data,
        buckets: buckets.map(b => ({
          ...b,
          label: b.label || this.formatBucketLabel(b.timestamp),
        })),
      };
    },
    transformDuration(data) {
      if (!data) return data;
      const distribution = data.distribution || data.buckets || [];
      return {
        ...data,
        buckets: distribution.map(b => ({
          label: b.rangeLabel || b.label || '',
          count: b.count ?? 0,
        })),
      };
    },
    transformHeatmap(data) {
      if (!data) return data;
      if (data.days) return data;
      if (!data.heatmap) return data;
      const dayMap = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat', 7: 'sun' };
      const dayOrder = [1, 2, 3, 4, 5, 6, 7];
      const grid = {};
      dayOrder.forEach(d => { grid[d] = new Array(24).fill(0); });
      data.heatmap.forEach(cell => {
        if (grid[cell.dayOfWeek] && cell.hourOfDay >= 0 && cell.hourOfDay < 24) {
          grid[cell.dayOfWeek][cell.hourOfDay] = cell.callCount || 0;
        }
      });
      return {
        ...data,
        days: dayOrder.map(d => ({ day: dayMap[d], hours: grid[d] })),
      };
    },
    transformCallers(data) {
      if (!data) return data;
      const result = { ...data };
      if (data.topCallers) {
        result.topCallers = data.topCallers.map(c => ({
          number: c.contactNumber || c.number || '',
          callCount: c.callCount || 0,
          totalDuration: c.totalDurationMs || c.totalDuration || 0,
          lastCall: c.lastCallTimestamp || c.lastCall || null,
        }));
      }
      return result;
    },
  },
};
</script>

<style lang="less" scoped>
@import "../assets/style/colors";
@import "../assets/style/fonts";

.analytics-container {
  margin: auto;
  max-width: 960px;
  padding: 0 16px 32px;
}

.analytics-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 16px;
  color: #333;
}

// Date controls
.date-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding-top: 16px;
}

// KPI Cards
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 16px;
}

.kpi-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.kpi-label {
  font-size: 0.85rem;
  color: #6b7280;
  margin-bottom: 8px;
}

.kpi-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: #111827;
}

.kpi-delta {
  font-size: 0.85rem;
  margin-top: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.delta-positive { color: #22C55E; }
.delta-negative { color: #EF4444; }
.delta-neutral { color: #6b7280; }

// Charts
.chart-container {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  height: 320px;
}

// Percentile / Stats row
.percentile-stats {
  display: flex;
  gap: 24px;
  justify-content: center;
  margin-top: 12px;
  flex-wrap: wrap;
}

.stat-item {
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 0.8rem;
  color: #6b7280;
}

.stat-value {
  display: block;
  font-size: 1.1rem;
  font-weight: 600;
  color: #111827;
}

// Heatmap
.heatmap-wrapper {
  overflow-x: auto;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: 60px repeat(24, 1fr) 44px;
  gap: 2px;
  min-width: 640px;
}

.heatmap-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  min-height: 28px;
}

.heatmap-corner {
  background: transparent;
}

.heatmap-hour-label {
  font-weight: 600;
  color: #6b7280;
  font-size: 0.7rem;
}

.heatmap-day-label {
  font-weight: 600;
  color: #6b7280;
  font-size: 0.75rem;
  justify-content: flex-end;
  padding-right: 8px;
}

.heatmap-value {
  border-radius: 3px;
  cursor: default;
  min-width: 20px;
}

.heatmap-text {
  color: #fff;
  font-weight: 600;
  font-size: 0.65rem;
  text-shadow: 0 0 2px rgba(0,0,0,0.3);
}

.heatmap-total-label {
  font-weight: 700;
  color: #374151;
}

.heatmap-total-value {
  font-weight: 700;
  font-size: 0.7rem;
  color: #374151;
  background: #f3f4f6;
  border-radius: 3px;
}

.heatmap-grand-total {
  background: #e5e7eb;
  color: #111827;
}

// Tables
.table-container {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
  margin-top: 12px;
}

// Empty state
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
}

.empty-state-icon {
  font-size: 3rem;
  margin-bottom: 16px;
  color: #d1d5db;
}

@media screen and (max-width: 640px) {
  .analytics-container {
    padding: 0 12px 24px;
  }

  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .chart-container {
    height: 260px;
    padding: 12px;
  }

  .date-controls {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
