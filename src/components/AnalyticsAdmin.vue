<template>
  <div style="width: 100%; height: 100%">
    <Toast />
    <ProgressBar
      mode="indeterminate"
      :style="{ height: '0.3em', visibility: anyLoading ? 'visible' : 'hidden' }"
    />
    <div v-if="user" class="analytics-container">

      <!-- Admin Mode Banner -->
      <div class="analytics-section">
        <div class="admin-mode-banner">
          <i class="pi pi-shield" style="margin-right: 8px;"></i>
          {{ $t('components.analytics.adminMode.title') }}
        </div>
      </div>

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

      <!-- Business Breakdown (admin-only) -->
      <div v-if="breakdownData" class="analytics-section">
        <h3 class="section-title">{{ $t('components.analytics.breakdown.title') }}</h3>
        <div class="kpi-grid" style="margin-bottom: 16px;">
          <div class="kpi-card">
            <div class="kpi-label">{{ $t('components.analytics.breakdown.totalBusinesses') }}</div>
            <div class="kpi-value">{{ formatNumber(breakdownTotalBusinesses) }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">{{ $t('components.analytics.breakdown.totalCalls') }}</div>
            <div class="kpi-value">{{ formatNumber(breakdownTotalCalls) }}</div>
          </div>
        </div>
        <div v-if="breakdownData.businesses && breakdownData.businesses.length > 0" class="chart-container" style="height: auto; min-height: 320px;">
          <Chart type="bar" :data="breakdownChartData" :options="breakdownChartOptions" />
        </div>
        <div v-if="breakdownData.businesses && breakdownData.businesses.length > 0" class="table-container" style="margin-top: 16px;">
          <DataTable :value="breakdownData.businesses" :rows="10" :paginator="breakdownData.businesses.length > 10" stripedRows
            sortField="totalCalls" :sortOrder="-1">
            <Column field="businessId" :header="$t('components.analytics.breakdown.businessId')" sortable />
            <Column field="totalCalls" :header="$t('components.analytics.breakdown.totalCalls')" sortable />
            <Column field="avgCallDurationMs" :header="$t('components.analytics.breakdown.avgDuration')" sortable>
              <template #body="slotProps">
                {{ formatDuration(slotProps.data.avgCallDurationMs) }}
              </template>
            </Column>
            <Column field="totalCallDurationMs" :header="$t('components.analytics.breakdown.totalDuration')" sortable>
              <template #body="slotProps">
                {{ formatDuration(slotProps.data.totalCallDurationMs) }}
              </template>
            </Column>
            <Column field="uniqueCallers" :header="$t('components.analytics.breakdown.uniqueCallers')" sortable />
            <Column :header="$t('components.analytics.breakdown.callPercentage')" sortable sortField="totalCalls">
              <template #body="slotProps">
                {{ breakdownTotalCalls > 0 ? ((slotProps.data.totalCalls / breakdownTotalCalls) * 100).toFixed(1) + '%' : '-' }}
              </template>
            </Column>
          </DataTable>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="allDataReady && noData" class="analytics-section">
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
import AnalyticsApi from "@/utils/Analytics";

export default {
  components: {},
  setup() {
    const store = useStore();
    const toast = useToast();
    return {
      store,
      toast,
      user: computed(() => store.state.user),
      authIsReady: computed(() => store.state.authIsReady),
    };
  },
  data() {
    return {
      router,
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
      breakdownData: null,

      // Loading flags
      loadingDashboard: false,
      loadingTimeseries: false,
      loadingDuration: false,
      loadingHeatmap: false,
      loadingCallers: false,
      loadingBreakdown: false,
    };
  },
  computed: {
    anyLoading() {
      return this.loadingDashboard || this.loadingTimeseries || this.loadingDuration ||
        this.loadingHeatmap || this.loadingCallers || this.loadingBreakdown;
    },
    allDataReady() {
      return !this.anyLoading;
    },
    noData() {
      return !this.dashboardData && !this.timeseriesData && !this.durationData &&
        !this.heatmapData && !this.callersData && !this.breakdownData;
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
    breakdownChartData() {
      if (!this.breakdownData || !this.breakdownData.businesses || !this.breakdownData.businesses.length) return { labels: [], datasets: [] };
      const sorted = [...this.breakdownData.businesses].sort((a, b) => b.totalCalls - a.totalCalls).slice(0, 20);
      return {
        labels: sorted.map(b => b.businessId),
        datasets: [{
          label: this.$t('components.analytics.breakdown.totalCalls'),
          data: sorted.map(b => b.totalCalls),
          backgroundColor: 'rgba(0,104,255,0.6)',
        }],
      };
    },
    breakdownChartOptions() {
      return {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 } },
        },
      };
    },
    breakdownTotalBusinesses() {
      if (!this.breakdownData || !this.breakdownData.businesses) return 0;
      return this.breakdownData.businesses.length;
    },
    breakdownTotalCalls() {
      if (!this.breakdownData || !this.breakdownData.businesses) return 0;
      return this.breakdownData.businesses.reduce((sum, b) => sum + (b.totalCalls || 0), 0);
    },
  },
  watch: {
    rangeValue(val) {
      if (val && val[0] && val[1]) {
        this.selectedPreset = null;
        this.timestampGte = val[0].getTime();
        this.timestampLte = val[1].getTime();
        this.fetchAllData();
      }
    },
  },
  mounted() {
    if (!this.store || !this.store.state) {
      return;
    }
    this.setPresetRange('30d');
    if (!this.store.state.user) {
      onAuthStateChanged(auth, (user) => {
        if (user && user.emailVerified && !user.isAnonymous) {
          this.fetchAllData();
        }
      });
    } else if (this.store.state.user.accessToken) {
      this.fetchAllData();
    }
  },
  methods: {
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
      this.rangeValue = [start, now];
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
      return {
        timestampGte: this.timestampGte,
        timestampLte: this.timestampLte,
      };
    },
    handleApiError(error, section) {
      if (error.response && error.response.status === 401) {
        this.store.dispatch('logout');
        router.push('/login');
        return;
      }
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

      const request = this.buildRequestBody();
      const granularity = this.getGranularity();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      this.fetchDashboard(user, request);
      this.fetchTimeseries(user, request, granularity);
      this.fetchDurationDistribution(user, request);
      this.fetchHourlyHeatmap(user, request, timezone);
      this.fetchCallers(user, request);
      this.fetchBusinessBreakdown(user, request);
    },
    fetchDashboard(user, request) {
      this.loadingDashboard = true;
      AnalyticsApi.dashboard(user, request)
        .then(response => { this.dashboardData = this.transformDashboard(response.data); })
        .catch(error => { this.handleApiError(error, 'dashboard'); })
        .finally(() => { this.loadingDashboard = false; });
    },
    fetchTimeseries(user, request, granularity) {
      this.loadingTimeseries = true;
      AnalyticsApi.timeseries(user, request, granularity)
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
    fetchBusinessBreakdown(user, request) {
      this.loadingBreakdown = true;
      AnalyticsApi.businessBreakdown(user, request)
        .then(response => { this.breakdownData = response.data; })
        .catch(error => { this.handleApiError(error, 'business-breakdown'); })
        .finally(() => { this.loadingBreakdown = false; });
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
    // --- Backend to Frontend transformations ---
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

// Admin mode banner
.admin-mode-banner {
  background: rgba(0, 104, 255, 0.08);
  border: 1px solid rgba(0, 104, 255, 0.25);
  border-radius: 8px;
  padding: 12px 16px;
  font-weight: 600;
  color: @mrcall_blue;
  display: flex;
  align-items: center;
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
