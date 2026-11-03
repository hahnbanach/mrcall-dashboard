<template>
  <div v-if="status !== 'absent'" class="analytics-section call-insights-section" :aria-busy="status === 'loading' ? 'true' : 'false'">
    <h3 class="section-title">{{ $t("components.callInsights.quality.title") }}</h3>
    <div v-if="status === 'unavailable'" class="insights-note">
      {{ $t("components.callInsights.notAvailableYet") }}
    </div>
    <!-- While a new answer is on its way the previous one stays (marked busy): a section that emptied
         itself made the page shrink and jump under the user (the D12 review, a row chosen on a phone). -->
    <template v-else-if="(status === 'ok' || status === 'loading') && data">
      <!-- One table for every signal, so that each number sits under its column's name on a ruled line: the CTO found
           the earlier list unreadable (2026-11-01), counts floating at the far right of long explanations, each repeating
           "of N calls". The count, the calls it is counted on and the share are three columns; a group's name is a row. -->
      <div v-sticky-head class="quality-table-wrap">
        <table class="quality-table">
          <caption class="visually-hidden">{{ $t("components.callInsights.quality.title") }}</caption>
          <thead>
            <tr>
              <th scope="col">{{ $t("components.callInsights.quality.columns.signal") }}</th>
              <th scope="col" class="num">{{ $t("components.callInsights.quality.columns.calls") }}</th>
              <th scope="col" class="num">
                <span class="quality-head">{{ $t("components.callInsights.quality.columns.base") }}<ColumnHelp :column="$t('components.callInsights.quality.columns.base')" :text="$t('components.callInsights.quality.help.base')" /></span>
              </th>
              <th scope="col">
                <span class="quality-head">{{ $t("components.callInsights.quality.columns.share") }}<ColumnHelp :column="$t('components.callInsights.quality.columns.share')" :text="$t('components.callInsights.quality.help.share')" /></span>
              </th>
              <th scope="col"><span class="visually-hidden">{{ $t("components.callInsights.quality.columns.actions") }}</span></th>
            </tr>
          </thead>
          <tbody v-for="group in groups" :key="group.key" class="quality-group" :data-group="group.key">
            <tr class="quality-group-row">
              <th scope="colgroup" colspan="5">{{ $t(group.title) }}</th>
            </tr>
            <tr v-for="row in group.rows" :key="row.id" class="quality-row" :class="{ 'quality-row-total': row.total, 'quality-row-sub': row.sub }" :data-signal="row.id">
              <th scope="row" class="quality-signal">
                <span class="quality-label">{{ $t(row.label) }}</span>
                <SignalExplain v-if="row.explain" :signal="row.explain" />
              </th>
              <td class="num quality-count" :data-label="$t('components.callInsights.quality.columns.calls')">
                <CountLink :to="linkTo(row.kind, row.key)" :signal="signalOf(row.kind, row.key)" :body="signalBody" :count="row.count" :display="formatNumber(row.count)" :label="$t(row.countLabel || row.label)" />
              </td>
              <td class="num quality-base" :data-label="$t('components.callInsights.quality.columns.base')">{{ formatNumber(row.base) }}</td>
              <td class="quality-share" :data-label="$t('components.callInsights.quality.columns.share')">
                <span class="quality-share-value">{{ formatShare(row) }}</span>
                <span class="quality-bar" aria-hidden="true"><span class="quality-bar-fill" :style="{ width: barWidth(row) }"></span></span>
              </td>
              <td class="quality-actions" :class="{ 'quality-actions-none': !showQuestions(row) }">
                <Button
                  v-if="showQuestions(row)"
                  type="button" text size="small" class="quality-questions"
                  :label="$t('components.callInsights.questionsPanel.show')"
                  :aria-label="$t('components.callInsights.questionsPanel.showOf', { label: $t(row.label) })"
                  @click="openQuestions(row.key, $event.currentTarget)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import CountLink from "@/components/analytics/CountLink.vue";
import SignalExplain from "@/components/analytics/SignalExplain.vue";
import ColumnHelp from "@/components/analytics/ColumnHelp.vue";

const Q = "components.callInsights.";

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
  components: { CountLink, SignalExplain, ColumnHelp },
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
    // The table's rows, by group: each its count, the calls it is counted on (StarChat's base for that signal) and
    // what it opens. Skill errors and extraction issues share a group: one row each under a heading of their own read
    // as the heading said twice.
    groups() {
      const d = this.data || {};
      const recorded = d.callsWithUnansweredRecorded;
      return [
        {
          key: "unanswered",
          title: Q + "quality.unansweredTitle",
          rows: [
            { id: "unanswered", kind: "unanswered", key: true, total: true, label: Q + "quality.anyUnanswered", countLabel: Q + "filters.unansweredLabel", count: d.callsWithUnanswered || 0, base: recorded },
            ...this.gapKeys.map((key) => ({ id: key, kind: "gap", key, sub: true, label: Q + "gaps." + key, explain: key, count: this.gaps[key] || 0, base: recorded, questions: true })),
          ],
        },
        {
          key: "checks",
          title: Q + "quality.checksTitle",
          rows: this.checkKeys.map((key) => ({ id: key, kind: "check", key, label: Q + "checks." + key, explain: key, count: this.checks[key] || 0, base: d.callsWithChecks })),
        },
        {
          key: "technical",
          title: Q + "quality.technicalTitle",
          rows: [
            { id: "skillErrors", kind: "skillErrors", key: true, label: Q + "quality.skillErrorsTitle", explain: "skillErrors", count: d.callsWithSkillErrors || 0, base: this.totalCalls },
            { id: "extraction", kind: "extractionFailed", key: true, label: Q + "quality.extractionTitle", explain: "extraction", count: this.extractionIssues.count, base: this.extractionIssues.base },
          ],
        },
      ];
    },
  },
  methods: {
    linkTo(kind, key) {
      return this.linkFor ? this.linkFor(kind, key) : null;
    },
    signalOf(kind, key) {
      return this.signalBody ? CallInsights.qualitySignal(kind, key) : null;
    },
    formatNumber(n) {
      return n == null ? "-" : n.toLocaleString(this.$i18n.locale);
    },
    share(row) {
      return row.base ? row.count / row.base : null;
    },
    formatShare(row) {
      const share = this.share(row);
      if (share == null) return "-";
      return share.toLocaleString(this.$i18n.locale, { style: "percent", maximumFractionDigits: 1 });
    },
    // a count above zero always shows a sliver, so that 1 of 4,000 does not read as none
    barWidth(row) {
      const share = this.share(row);
      if (!share) return "0";
      return "max(2px, " + Math.min(100, share * 100).toFixed(2) + "%)";
    },
    showQuestions(row) {
      return !!(row.questions && this.questionsBody && this.analyticsOverlay && row.count > 0);
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
@import "../../assets/style/tableCards";

.insights-note {
  color: @mrcall_grey_text;
  font-size: 14px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

// On white as every analytics table (PagedTable.vue): the blue counts read 4.7:1 there, the grey texts above 4.5:1
.quality-table-wrap {
  overflow-x: auto;
  background: @mrcall_white;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
}

.quality-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  color: @mrcall_dark_grey_text;

  th, td {
    text-align: left;
    padding: 10px 12px;
    border-bottom: 1px solid @mrcall_borders;
    vertical-align: top;
  }

  thead th {
    font-size: 12px;
    font-weight: 700;
    color: @mrcall_grey_text;
    white-space: nowrap;
    background: @mrcall_white;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  thead th.num .quality-head {
    justify-content: flex-end;
  }

  tbody:last-child tr:last-child > * {
    border-bottom: none;
  }
}

.quality-head {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

// A group's name across the table, on a tinted band, so that the groups read apart
.quality-group-row th {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  color: @mrcall_grey_text;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: #f5f7fa;
}

.quality-row:hover > * {
  background: #fafbfc;
}

.quality-signal {
  font-weight: 400;
  min-width: 260px;
}

.quality-label {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: @mrcall_dark_grey_text;
}

// the explanation reads as a note under its signal, not as a second label: one size down and grey throughout
.quality-signal :deep(.signal-explain),
.quality-signal :deep(.signal-action) {
  margin-top: 3px;
  font-size: 13px;
  color: @mrcall_grey_text;
}

.quality-row-total .quality-label {
  font-weight: 700;
}

// the reasons are parts of the total row above them
.quality-row-sub .quality-signal {
  padding-left: 28px;
}

.quality-count {
  font-weight: 700;
  font-size: 15px;
}

.quality-base {
  color: @mrcall_grey_text;
}

.quality-share {
  white-space: nowrap;
  width: 160px;
}

.quality-share-value {
  display: inline-block;
  min-width: 48px;
  font-variant-numeric: tabular-nums;
}

// neutral, never a failure colour: a share is how often, not how bad
.quality-bar {
  display: inline-block;
  vertical-align: middle;
  width: 90px;
  height: 6px;
  margin-left: 8px;
  border-radius: 3px;
  background: #e8edf3;
  overflow: hidden;
}

.quality-bar-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: #5b7fa6;
}

.quality-actions {
  white-space: nowrap;
  text-align: right;
  width: 1%;
}

.quality-questions.p-button {
  padding: 0 4px;
  color: @mrcall_blue_text;
}

// Phones: each signal a card, each value under its column's name (src/assets/style/tableCards.less)
@media screen and (max-width: 640px) {
  .quality-table-wrap {
    border: none;
    background: transparent;
  }

  .quality-table {
    .table-cards();

    .num {
      text-align: left;
    }

    tbody tr.quality-group-row {
      display: block;
      background: transparent;
      border: none;
      margin: 8px 0 4px 0;
      padding: 0;

      th {
        background: transparent;
        padding: 0 4px;
      }
    }

    .quality-row-sub .quality-signal {
      padding-left: 12px;
    }

    .quality-signal {
      min-width: 0;
    }

    // a card's cells are flex columns: keep each value at its label's start, and the action at its natural width
    td {
      align-items: flex-start;
    }

    .quality-share,
    .quality-actions {
      width: auto;
    }

    .quality-actions-none {
      display: none;
    }
  }
}
</style>
