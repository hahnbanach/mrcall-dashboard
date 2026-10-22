<template>
  <div
    v-if="status !== 'absent'"
    class="analytics-section call-insights-section"
    :aria-busy="updating ? 'true' : 'false'"
  >
    <h3 class="section-title">{{ $t("components.callInsights.howCallsWent.title") }}</h3>
    <div v-if="updating" class="insights-updating" role="status">
      <ProgressBar mode="indeterminate" class="insights-updating-bar" />
      <span>{{ $t("components.callInsights.howCallsWent.updating") }}</span>
    </div>
    <div v-if="status === 'unavailable'" class="insights-note">
      {{ $t("components.callInsights.notAvailableYet") }}
    </div>
    <!-- While a refetch is under way the previous answer stays: unmounting the two charts at every
         refetch races PrimeVue's Chart, whose chart.js chunk loads asynchronously and then builds a
         chart on a canvas that is already gone (a TypeError in `new Chart`, which the dev server's
         overlay shows over the page). -->
    <template v-else-if="data">
      <div v-for="dim in dimensions" :key="dim.name" class="insight-dimension" :class="{ 'is-updating': updating }">
        <h4 class="insight-dimension-title">{{ $t("components.callInsights.dimensions." + dim.name) }}</h4>
        <p class="coverage-note">
          {{ $t("components.callInsights.howCallsWent.coverage", { count: dim.callsWithValue, total: data.totalCalls || 0 }) }}
        </p>
        <p v-if="dim.share" class="coverage-note">
          {{ $t("components.callInsights.howCallsWent.shareBase", { count: formatNumber(dim.share.base) }) }}
        </p>
        <div class="chart-container">
          <Chart type="bar" :data="dim.chartData" :options="chartOptions" />
        </div>
        <ul class="outcome-legend in-share">
          <li v-for="key in dim.keys" :key="key">
            <span class="legend-swatch" :style="{ background: colorOf(key) }" aria-hidden="true"></span>
            <InsightLabel :dimension="dim.name" :value="key" />
            <span class="legend-count">{{ formatNumber(dim.totals[key] || 0) }}</span>
            <span v-if="dim.share" class="legend-share">
              {{ $t("components.callInsights.howCallsWent.shareOfBase", { percent: dim.share.percent[key], base: formatNumber(dim.share.base) }) }}
            </span>
            <span v-if="delta(dim, key) !== null" class="legend-delta" :class="deltaClass(delta(dim, key))">
              <i :class="deltaIcon(delta(dim, key))"></i>
              {{ formatDeltaPercentage(delta(dim, key)) }}
            </span>
          </li>
        </ul>
        <!-- Counted beside the share, never in it, and in neutral colours: neither is a failure -->
        <div v-if="dim.outside.length" class="outside-share">
          <h5 class="outside-share-title">{{ $t("components.callInsights.howCallsWent.outsideTitle") }}</h5>
          <ul class="outcome-legend">
            <li v-for="row in dim.outside" :key="row.key">
              <span class="legend-swatch" :style="{ background: colorOf(row.key) }" aria-hidden="true"></span>
              <InsightLabel :dimension="dim.name" :value="row.key" />
              <span class="legend-count">{{ formatNumber(row.count) }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="insight-facts" :class="{ 'is-updating': updating }">
        <p class="insight-booked">
          {{ $t("components.callInsights.howCallsWent.booked", { booked: formatNumber(data.booked || 0), total: formatNumber(data.callsWithBooked || 0) }) }}
        </p>
        <p class="insight-transferred">
          {{ $t("components.callInsights.howCallsWent.transferred", { count: formatNumber(data.transferred || 0) }) }}
        </p>
      </div>

      <!-- The calls the assistant had no conversation in: facts by reason, outside every rate above,
           so a count each and never a share or a failure colour -->
      <div v-if="noConversation" class="no-conversation" :class="{ 'is-updating': updating }">
        <h4 class="insight-dimension-title">{{ $t("components.callInsights.noConversation.title") }}</h4>
        <p class="coverage-note">{{ $t("components.callInsights.noConversation.note") }}</p>
        <ul class="no-conversation-list">
          <li v-for="row in noConversation" :key="row.key">
            <span>{{ $t("components.callInsights.noConversation.reasons." + row.key) }}</span>
            <span class="no-conversation-count">{{ formatNumber(row.count) }}</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import InsightLabel from "@/components/analytics/InsightLabel.vue";

/**
 * "How the calls went" (brief outcomes 3 and 9, insights version 2): the resolution and the message
 * of the period's calls as a stacked bar each, the totals against the previous period, and how many
 * of the period's calls carry the dimension at all (`callsWithValue` of `totalCalls`: calls from
 * before the feature, and calls whose extraction failed, carry none). Resolution is a share only
 * over the calls where the caller asked something; `caller_left` and `spam_wrong_number` are
 * counted beside it (`CallInsights.resolutionShare`). Booked is shown beside the calls it counts on
 * (`callsWithBooked`: the calls the extraction answered for), transferred as a count only
 * (`transferred`: no denominator exists, the carriers that report no transfer leg are in every
 * base). Under them, the calls without a conversation, by reason (`noConversation`). Purely
 * presentational: the parent fetches `CallInsights.outcomes` and passes the answer down, the same
 * way every other section of this page already works.
 */
// `caller_left` and `spam_wrong_number` are neutral, and told apart: the page's grey tokens
// @mrcall_grey_text2 and @mrcall_light_grey_1 (Chart.js needs the values, not the LESS names).
const COLORS = {
  resolved: "#22C55E",
  unresolved: "#EF4444",
  handed_over: "#0068FF",
  caller_left: "#6C757D",
  spam_wrong_number: "#D7DCE2",
  complete: "#22C55E",
  incomplete: "#F59E0B",
  unintelligible: "#A78BFA",
  none: "#9CA3AF",
};

// The keys each dimension lists in its legend; resolution's two others sit apart, outside its share.
const KEYS = { resolution: CallInsights.RESOLUTION_REQUEST_KEYS, message: CallInsights.MESSAGE_KEYS };
const CHART_KEYS = { resolution: CallInsights.RESOLUTION_KEYS, message: CallInsights.MESSAGE_KEYS };

export default {
  components: { InsightLabel },
  props: {
    status: { type: String, required: true }, // loading | ok | absent | unavailable
    data: { type: Object, default: null },
  },
  computed: {
    // The previous answer stays on screen while the next is fetched (see above), so it is marked
    // as pending: dimmed, with a progress bar and a note, and `aria-busy` on the section.
    updating() {
      return this.status === "loading" && !!this.data;
    },
    // A malformed or placeholder answer (an empty array, from a test's generic fallback) must not
    // crash the page: every real `OutcomesResponse` carries both dimensions with their maps, but
    // nothing here assumes it.
    dimensions() {
      return ["resolution", "message"].map((name) => {
        const dimension = (this.data && this.data[name]) || {};
        const buckets = dimension.buckets || [];
        const keys = KEYS[name];
        const resolution = name === "resolution" ? CallInsights.resolutionShare(dimension.totals) : null;
        return {
          name,
          keys,
          callsWithValue: dimension.callsWithValue || 0,
          totals: dimension.totals || {},
          previousTotals: dimension.previousTotals || {},
          share: resolution && {
            base: resolution.base,
            percent: Object.fromEntries(resolution.rows.map((row) => [row.key, row.percent])),
          },
          outside: resolution ? resolution.outside : [],
          chartData: {
            labels: buckets.map((b) => new Date(b.timestamp).toLocaleDateString()),
            datasets: CHART_KEYS[name].map((key) => ({
              label: this.$t("components.callInsights." + name + "." + key),
              data: buckets.map((b) => (b.counts && b.counts[key]) || 0),
              backgroundColor: this.colorOf(key),
              stack: name,
            })),
          },
        };
      });
    },
    // StarChat sends `noConversation` from the release that classifies those calls; an answer without
    // it has no such section rather than four zeros it does not know.
    noConversation() {
      const map = this.data && this.data.noConversation;
      if (!map || typeof map !== "object") return null;
      return CallInsights.noConversationRows(map);
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
    colorOf(key) {
      return COLORS[key] || "#9CA3AF";
    },
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

.is-updating {
  opacity: 0.5;
  transition: opacity 0.2s;
}

.insights-updating {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 13px;
  color: @mrcall_grey_text;
}

.insights-updating-bar {
  width: 120px;
  height: 0.3em;
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

.legend-swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.legend-share {
  color: @mrcall_grey_text;
  font-size: 13px;
}

.outside-share {
  margin-top: 16px;

  .outcome-legend {
    margin-top: 8px;
  }
}

.outside-share-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: @mrcall_grey_text2;
}

.no-conversation {
  margin-top: 24px;
}

.no-conversation-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;

  li {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
    color: @mrcall_grey_text;
  }
}

.no-conversation-count {
  font-weight: 600;
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
