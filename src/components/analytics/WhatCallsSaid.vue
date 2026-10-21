<template>
  <div v-if="status !== 'absent'" class="analytics-section call-insights-section">
    <h3 class="section-title">{{ $t("components.callInsights.whatCallsSaid.title") }}</h3>
    <div v-if="status === 'unavailable'" class="insights-note">
      {{ $t("components.callInsights.notAvailableYet") }}
    </div>
    <!-- While a refetch is under way the previous answer stays: unmounting the two charts at every
         refetch races PrimeVue's Chart, whose chart.js chunk loads asynchronously and then builds a
         chart on a canvas that is already gone (a TypeError in `new Chart`, which the dev server's
         overlay shows over the page). -->
    <template v-else-if="data">
      <div v-for="dim in dimensions" :key="dim.name" class="insight-dimension">
        <h4 class="insight-dimension-title">{{ $t("components.callInsights.dimensions." + dim.name) }}</h4>
        <p class="coverage-note">
          {{ $t("components.callInsights.whatCallsSaid.coverage", { count: dim.callsWithValue, total: data.totalCalls || 0 }) }}
        </p>
        <div class="chart-container">
          <Chart type="bar" :data="dim.chartData" :options="chartOptions" />
        </div>
        <ul class="outcome-legend">
          <li v-for="key in dim.keys" :key="key">
            <InsightLabel :dimension="dim.name" :value="key" />
            <span class="legend-count">{{ formatNumber(dim.totals[key] || 0) }}</span>
            <span v-if="delta(dim, key) !== null" class="legend-delta" :class="deltaClass(delta(dim, key))">
              <i :class="deltaIcon(delta(dim, key))"></i>
              {{ formatDeltaPercentage(delta(dim, key)) }}
            </span>
          </li>
        </ul>
      </div>

      <div class="insight-facts">
        <p class="insight-booked">
          {{ $t("components.callInsights.whatCallsSaid.booked", { booked: formatNumber(data.booked || 0), total: formatNumber(data.callsWithBooked || 0) }) }}
        </p>
        <p class="insight-transferred">
          {{ $t("components.callInsights.whatCallsSaid.transferred", { count: formatNumber(data.transferred || 0) }) }}
        </p>
      </div>
    </template>
  </div>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import InsightLabel from "@/components/analytics/InsightLabel.vue";

/**
 * "What calls said" (brief outcome 3, insights version 2): the resolution and the message of the
 * period's calls as a stacked bar each, the totals against the previous period, and how many of
 * the period's calls carry the dimension at all (`callsWithValue` of `totalCalls`: calls from
 * before the feature, and calls whose extraction failed, carry none). Booked is shown beside the
 * calls it counts on (`callsWithBooked`: the calls the extraction answered for), transferred as a
 * count only (`transferred`: no denominator exists, the carriers that report no transfer leg are in
 * every base). Purely presentational: the parent fetches `CallInsights.outcomes` and passes the
 * answer down, the same way every other section of this page already works.
 */
const COLORS = {
  resolved: "#22C55E",
  unresolved: "#EF4444",
  handed_over: "#0068FF",
  caller_left: "#F97316",
  spam_wrong_number: "#9CA3AF",
  complete: "#22C55E",
  incomplete: "#F59E0B",
  unintelligible: "#A78BFA",
  none: "#9CA3AF",
};

const KEYS = { resolution: CallInsights.RESOLUTION_KEYS, message: CallInsights.MESSAGE_KEYS };

export default {
  components: { InsightLabel },
  props: {
    status: { type: String, required: true }, // loading | ok | absent | unavailable
    data: { type: Object, default: null },
  },
  computed: {
    // A malformed or placeholder answer (an empty array, from a test's generic fallback) must not
    // crash the page: every real `OutcomesResponse` carries both dimensions with their maps, but
    // nothing here assumes it.
    dimensions() {
      return ["resolution", "message"].map((name) => {
        const dimension = (this.data && this.data[name]) || {};
        const buckets = dimension.buckets || [];
        const keys = KEYS[name];
        return {
          name,
          keys,
          callsWithValue: dimension.callsWithValue || 0,
          totals: dimension.totals || {},
          previousTotals: dimension.previousTotals || {},
          chartData: {
            labels: buckets.map((b) => new Date(b.timestamp).toLocaleDateString()),
            datasets: keys.map((key) => ({
              label: this.$t("components.callInsights." + name + "." + key),
              data: buckets.map((b) => (b.counts && b.counts[key]) || 0),
              backgroundColor: COLORS[key] || "#9CA3AF",
              stack: name,
            })),
          },
        };
      });
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
    delta(dim, key) {
      const prev = dim.previousTotals[key];
      if (prev == null || prev === 0) return null;
      const current = dim.totals[key] || 0;
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

.insight-dimension {
  margin-bottom: 24px;
}

.insight-dimension-title {
  margin: 0 0 4px 0;
  font-size: 15px;
  font-weight: 600;
  color: @mrcall_dark_grey_text;
}

.insight-facts p {
  margin: 0 0 6px 0;
  font-size: 14px;
  color: @mrcall_dark_grey_text;
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
