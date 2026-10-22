<template>
  <div v-if="status !== 'absent'" class="analytics-section call-insights-section" :aria-busy="status === 'loading' ? 'true' : 'false'">
    <h3 class="section-title">{{ $t("components.callInsights.quality.title") }}</h3>
    <div v-if="status === 'unavailable'" class="insights-note">
      {{ $t("components.callInsights.notAvailableYet") }}
    </div>
    <!-- While a new answer is on its way the previous one stays (marked busy): a section that emptied
         itself made the page shrink and jump under the user (the D12 review, a row chosen on a phone). -->
    <template v-else-if="(status === 'ok' || status === 'loading') && data">
      <div class="quality-group">
        <h4 class="quality-group-title">{{ $t("components.callInsights.quality.unansweredTitle") }}</h4>
        <p class="quality-row quality-row-total">
          {{ $t("components.callInsights.quality.countOfTotal", { count: data.callsWithUnanswered, total: data.callsWithUnansweredRecorded }) }}
        </p>
        <ul class="quality-breakdown">
          <li v-for="key in gapKeys" :key="key">
            <span>{{ $t("components.callInsights.gaps." + key) }}</span>
            <span class="quality-count">{{ countOfTotal(gaps[key], data.callsWithUnansweredRecorded) }}</span>
          </li>
        </ul>
      </div>

      <div class="quality-group">
        <h4 class="quality-group-title">{{ $t("components.callInsights.quality.checksTitle") }}</h4>
        <ul class="quality-breakdown">
          <li v-for="key in checkKeys" :key="key">
            <span>{{ $t("components.callInsights.checks." + key) }}</span>
            <span class="quality-count">{{ countOfTotal(checks[key], data.callsWithChecks) }}</span>
          </li>
        </ul>
      </div>

      <div class="quality-group">
        <h4 class="quality-group-title">{{ $t("components.callInsights.quality.skillErrorsTitle") }}</h4>
        <p class="quality-row">{{ countOfTotal(data.callsWithSkillErrors, totalCalls) }}</p>
      </div>

      <div class="quality-group">
        <h4 class="quality-group-title">{{ $t("components.callInsights.quality.extractionTitle") }}</h4>
        <p class="quality-row">{{ countOfTotal(extractionIssues.count, extractionIssues.base) }}</p>
      </div>
    </template>
  </div>
</template>

<script>
import CallInsights from "@/utils/CallInsights";

/**
 * The quality signals of the calls in the period (brief outcome 3), each beside the number of
 * calls it is counted on: unanswered questions by reason, the checks that fired, skill errors and
 * extraction failures. No score: StarChat has not calibrated their weights (Mycelium 5e6dbb40).
 * `totalCalls` is the outcomes answer's own `totalCalls`, the counting base the quality answer
 * itself does not carry for skill errors; extraction failures are counted over its own `extractions`
 * (brief outcome 9: `http_error` and `failed` only).
 */
export default {
  props: {
    status: { type: String, required: true },
    data: { type: Object, default: null },
    totalCalls: { type: Number, default: null },
  },
  computed: {
    gapKeys() {
      return CallInsights.GAP_KEYS;
    },
    checkKeys() {
      return CallInsights.CHECK_KEYS;
    },
    // Guards against a malformed or placeholder answer the same way CallOutcomes.vue does.
    gaps() {
      return (this.data && this.data.gaps) || {};
    },
    checks() {
      return (this.data && this.data.checks) || {};
    },
    // `http_error` and `failed` over the calls whose extraction ran, from StarChat's `extractions`: a
    // call from before the outcome was recorded is no issue, so the period's total is not the base,
    // and `not_managed` (never asked of the model) is neither an issue nor in the base.
    extractionIssues() {
      return CallInsights.extractionProblems(this.data && this.data.extractions);
    },
  },
  methods: {
    countOfTotal(count, total) {
      const safeCount = count || 0;
      if (total == null) return String(safeCount);
      return this.$t("components.callInsights.quality.countOfTotal", { count: safeCount, total });
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

.quality-group {
  margin-bottom: 18px;

  &:last-child {
    margin-bottom: 0;
  }
}

.quality-group-title {
  margin: 0 0 6px 0;
  font-size: 13px;
  font-weight: 700;
  color: @mrcall_grey_text2;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.quality-row {
  margin: 0;
  font-size: 15px;
  color: @mrcall_dark_grey_text;
}

.quality-row-total {
  font-weight: 600;
  margin-bottom: 6px;
}

.quality-breakdown {
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
    color: @mrcall_dark_grey_text;
  }
}

.quality-count {
  color: @mrcall_grey_text;
}
</style>
