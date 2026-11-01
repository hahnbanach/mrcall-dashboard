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
        <i18n-t keypath="components.callInsights.quality.countOfTotal" tag="p" class="quality-row quality-row-total" scope="global">
          <template #count><CountLink :to="linkTo('unanswered', true)" :signal="signalOf('unanswered', true)" :body="signalBody" :count="data.callsWithUnanswered || 0" :label="$t('components.callInsights.filters.unansweredLabel')" /></template>
          <template #total>{{ data.callsWithUnansweredRecorded }}</template>
        </i18n-t>
        <ul class="quality-breakdown">
          <li v-for="key in gapKeys" :key="key">
            <div class="quality-item">
              <span>{{ $t("components.callInsights.gaps." + key) }}</span>
              <span class="quality-item-end">
              <i18n-t keypath="components.callInsights.quality.countOfTotal" tag="span" class="quality-count" scope="global">
                <template #count><CountLink :to="linkTo('gap', key)" :signal="signalOf('gap', key)" :body="signalBody" :count="gaps[key] || 0" :label="$t('components.callInsights.gaps.' + key)" /></template>
                <template #total>{{ data.callsWithUnansweredRecorded }}</template>
              </i18n-t>
              <Button
                v-if="questionsBody && analyticsOverlay && (gaps[key] || 0) > 0"
                type="button" text size="small" class="quality-questions"
                :label="$t('components.callInsights.questionsPanel.show')"
                :aria-label="$t('components.callInsights.questionsPanel.showOf', { label: $t('components.callInsights.gaps.' + key) })"
                @click="openQuestions(key, $event.currentTarget)"
              />
              </span>
            </div>
            <SignalExplain :signal="key" />
          </li>
        </ul>
      </div>

      <div class="quality-group">
        <h4 class="quality-group-title">{{ $t("components.callInsights.quality.checksTitle") }}</h4>
        <ul class="quality-breakdown">
          <li v-for="key in checkKeys" :key="key">
            <div class="quality-item">
              <span>{{ $t("components.callInsights.checks." + key) }}</span>
              <i18n-t keypath="components.callInsights.quality.countOfTotal" tag="span" class="quality-count" scope="global">
                <template #count><CountLink :to="linkTo('check', key)" :signal="signalOf('check', key)" :body="signalBody" :count="checks[key] || 0" :label="$t('components.callInsights.checks.' + key)" /></template>
                <template #total>{{ data.callsWithChecks }}</template>
              </i18n-t>
            </div>
            <SignalExplain :signal="key" />
          </li>
        </ul>
      </div>

      <div class="quality-group">
        <h4 class="quality-group-title">{{ $t("components.callInsights.quality.skillErrorsTitle") }}</h4>
        <i18n-t v-if="totalCalls != null" keypath="components.callInsights.quality.countOfTotal" tag="p" class="quality-row" scope="global">
          <template #count><CountLink :to="linkTo('skillErrors', true)" :signal="signalOf('skillErrors', true)" :body="signalBody" :count="data.callsWithSkillErrors || 0" :label="$t('components.callInsights.quality.skillErrorsTitle')" /></template>
          <template #total>{{ totalCalls }}</template>
        </i18n-t>
        <p v-else class="quality-row"><CountLink :to="linkTo('skillErrors', true)" :signal="signalOf('skillErrors', true)" :body="signalBody" :count="data.callsWithSkillErrors || 0" :label="$t('components.callInsights.quality.skillErrorsTitle')" /></p>
        <SignalExplain signal="skillErrors" />
      </div>

      <div class="quality-group">
        <h4 class="quality-group-title">{{ $t("components.callInsights.quality.extractionTitle") }}</h4>
        <i18n-t keypath="components.callInsights.quality.countOfTotal" tag="p" class="quality-row" scope="global">
          <template #count><CountLink :to="linkTo('extractionFailed', true)" :signal="signalOf('extractionFailed', true)" :body="signalBody" :count="extractionIssues.count" :label="$t('components.callInsights.quality.extractionTitle')" /></template>
          <template #total>{{ extractionIssues.base }}</template>
        </i18n-t>
        <SignalExplain signal="extraction" />
      </div>
    </template>
  </div>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import CountLink from "@/components/analytics/CountLink.vue";
import SignalExplain from "@/components/analytics/SignalExplain.vue";

/**
 * The quality signals of the calls in the period (brief outcome 3), each beside the number of
 * calls it is counted on: unanswered questions by reason, the checks that fired, skill errors and
 * extraction failures. No score: StarChat has not calibrated their weights (Mycelium 5e6dbb40).
 * `totalCalls` is the outcomes answer's own `totalCalls`, the counting base the quality answer
 * itself does not carry for skill errors; extraction failures are counted over its own `extractions`
 * (brief outcome 9), with StarChat's failures `http_error`, `failed` and `too_long`. Each signal says what it means and
 * what to do about it (`SignalExplain`, brief docs/briefs/2026-10-31-analytics-ux.md, O5).
 */
export default {
  components: { CountLink, SignalExplain },
  inject: { analyticsOverlay: { default: null } },
  props: {
    status: { type: String, required: true },
    data: { type: Object, default: null },
    totalCalls: { type: Number, default: null },
    // (kind, key) => the conversations list of the counted calls, or null (CallOutcomes.vue's `linkFor`)
    linkFor: { type: Function, default: null },
    // a page over several businesses: its analytics body, so that each count opens the businesses where it happened
    // (StarChat's analytics guide §9); null on one business's page, where the counts open their calls
    signalBody: { type: Object, default: null },
    // the page's analytics body for a gap reason's unanswered questions (§14), on every page that has a host
    questionsBody: { type: Object, default: null },
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
    // `http_error`, `failed` and `too_long` over the calls whose extraction ran or was refused for size, from StarChat's `extractions`: a
    // call from before the outcome was recorded is no issue, so the period's total is not the base,
    // and `not_managed` (never asked of the model) is neither an issue nor in the base.
    extractionIssues() {
      return CallInsights.extractionProblems(this.data && this.data.extractions);
    },
  },
  methods: {
    linkTo(kind, key) {
      return this.linkFor ? this.linkFor(kind, key) : null;
    },
    signalOf(kind, key) {
      return this.signalBody ? CallInsights.qualitySignal(kind, key) : null;
    },
    openQuestions(gap, trigger) {
      const label = this.$t("components.callInsights.questionsPanel.title", { label: this.$t("components.callInsights.gaps." + gap) });
      this.analyticsOverlay.openQuestions(gap, label, this.questionsBody, !!this.signalBody, trigger);
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
  // on the page's grey @mrcall_grey_text2 is 3.7:1 (U19c m2)
  color: @mrcall_grey_text;
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
  gap: 10px;

  li {
    font-size: 14px;
    color: @mrcall_dark_grey_text;
  }

  .quality-item {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 12px;
  }

  .quality-item-end {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: flex-end;
    gap: 0 8px;
    margin-left: auto;
  }

  .quality-questions.p-button {
    padding: 0 4px;
    color: @mrcall_blue_text;
  }
}

.quality-count {
  color: @mrcall_grey_text;
}
</style>
