<template>
  <div v-if="status !== 'absent'" class="analytics-section call-insights-section">
    <h3 class="section-title">{{ $t("components.callInsights.whatCallsSaid.title") }}</h3>
    <div v-if="status === 'unavailable'" class="insights-note">
      {{ $t("components.callInsights.notAvailableYet") }}
    </div>
    <template v-else-if="status === 'ok' && data">
      <p class="coverage-note">
        {{ $t("components.callInsights.whatCallsSaid.coverage", { withOutcome: data.callsWithOutcome || 0, total: data.totalCalls || 0 }) }}
      </p>
      <div class="chart-container">
        <Chart type="bar" :data="chartData" :options="chartOptions" />
      </div>
      <ul class="outcome-legend">
        <li v-for="key in outcomeKeys" :key="key">
          <OutcomeLabel :outcome-key="key" />
          <span class="legend-count">{{ formatNumber(totals[key] || 0) }}</span>
          <span v-if="delta(key) !== null" class="legend-delta" :class="deltaClass(delta(key))">
            <i :class="deltaIcon(delta(key))"></i>
            {{ formatDeltaPercentage(delta(key)) }}
          </span>
        </li>
      </ul>
    </template>
  </div>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import OutcomeLabel from "@/components/analytics/OutcomeLabel.vue";

/**
 * "What calls said" (brief outcome 3): outcomes over the period as a stacked bar, the totals
 * against the previous period, and how many of the period's calls have a recorded outcome at all
 * (`callsWithOutcome` of `totalCalls`: calls from before the feature, and calls whose extraction
 * failed, have none). Purely presentational: the parent fetches `CallInsights.outcomes` and passes
 * the answer down, the same way every other section of this page already works.
 */
const COLORS = {
  booked: "#0068FF",
  transferred: "#22C55E",
  resolved: "#60A5FA",
  message_taken: "#A78BFA",
  unresolved: "#EF4444",
  caller_left: "#F97316",
  spam_wrong_number: "#9CA3AF",
};

export default {
  components: { OutcomeLabel },
  props: {
    status: { type: String, required: true }, // loading | ok | absent | unavailable
    data: { type: Object, default: null },
  },
  computed: {
    outcomeKeys() {
      return CallInsights.OUTCOME_KEYS;
    },
    // A malformed or placeholder answer (an empty array, from a test's generic fallback) must not
    // crash the page: every real `OutcomesResponse` carries these two maps, but nothing here
    // assumes it.
    totals() {
      return (this.data && this.data.totals) || {};
    },
    previousTotals() {
      return (this.data && this.data.previousTotals) || {};
    },
    chartData() {
      const buckets = (this.data && this.data.buckets) || [];
      return {
        labels: buckets.map((b) => new Date(b.timestamp).toLocaleDateString()),
        datasets: this.outcomeKeys.map((key) => ({
          label: this.$t("components.callInsights.outcomes." + key),
          data: buckets.map((b) => (b.counts && b.counts[key]) || 0),
          backgroundColor: COLORS[key] || "#9CA3AF",
          stack: "outcomes",
        })),
      };
    },
    chartOptions() {
      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
        },
      };
    },
  },
  methods: {
    delta(key) {
      const prev = this.previousTotals[key];
      if (prev == null || prev === 0) return null;
      const current = this.totals[key] || 0;
      return (current - prev) / prev;
    },
    deltaClass(delta) {
      if (delta > 0) return "delta-positive";
      if (delta < 0) return "delta-negative";
      return "delta-neutral";
    },
    deltaIcon(delta) {
      if (delta > 0) return "pi pi-arrow-up";
      if (delta < 0) return "pi pi-arrow-down";
      return "pi pi-minus";
    },
    formatNumber(n) {
      return n == null ? "-" : n.toLocaleString();
    },
    formatDeltaPercentage(n) {
      return n == null ? "-" : (n * 100).toFixed(1) + "%";
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.insights-note {
  color: @mrcall_grey_text;
  font-size: 14px;
}

.coverage-note {
  color: @mrcall_grey_text;
  font-size: 14px;
  margin: 0 0 12px 0;
}

.chart-container {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  height: 280px;
}

.outcome-legend {
  list-style: none;
  margin: 16px 0 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
  }
}

.legend-count {
  font-weight: 700;
  color: @mrcall_dark_grey_text;
}

.legend-delta {
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.delta-positive {
  color: #22c55e;
}

.delta-negative {
  color: #ef4444;
}

.delta-neutral {
  color: #6b7280;
}
</style>
