<template>
  <div v-if="status !== 'absent'" class="analytics-section call-insights-section" :aria-busy="status === 'loading' ? 'true' : 'false'">
    <h3 class="section-title">{{ $t("components.callInsights.topics.title") }}</h3>
    <div v-if="status === 'needsBusiness'" class="insights-note">
      {{ $t("components.callInsights.topics.chooseBusiness") }}
    </div>
    <div v-else-if="status === 'unavailable'" class="insights-note">
      {{ $t("components.callInsights.notAvailableYet") }}
    </div>
    <!-- While a new answer is on its way the previous one stays (marked busy): a section that emptied
         itself made the page shrink and jump under the user (the D12 review, a row chosen on a phone). -->
    <template v-else-if="(status === 'ok' || status === 'loading') && data">
      <p class="topics-base">
        {{ $t("components.callInsights.topics.base", { count: formatNumber(data.callsWithTopics), previous: formatNumber(data.previousCallsWithTopics) }) }}
      </p>
      <div v-if="topics.length === 0" class="insights-note">
        {{ $t("components.callInsights.topics.none") }}
      </div>
      <div v-else v-sticky-head class="table-container">
        <ColumnHelpList :items="[{ label: $t('components.callInsights.topics.previousCalls'), help: $t('components.callInsights.help.topics.previousCalls') }]" />
        <!-- A topic is the model's own words: shown as text through the column's field, never as markup -->
        <DataTable :value="topics" :rows="10" :paginator="topics.length > 10" stripedRows>
          <Column field="topic" :header="$t('components.callInsights.topics.topic')" :pt="cellLabel($t('components.callInsights.topics.topic'))" />
          <Column :header="$t('components.callInsights.topics.calls')" :pt="cellLabel($t('components.callInsights.topics.calls'))">
            <template #body="slotProps"><CountLink :to="linkFor ? linkFor('topic', slotProps.data.topic) : null" :count="slotProps.data.calls || 0" :display="formatNumber(slotProps.data.calls)" :label="slotProps.data.topic" /></template>
          </Column>
          <Column :header="$t('components.callInsights.topics.previousCalls')" :pt="cellLabel($t('components.callInsights.topics.previousCalls'))">
            <template #header><ColumnHelp :column="$t('components.callInsights.topics.previousCalls')" :text="$t('components.callInsights.help.topics.previousCalls')" /></template>
            <template #body="slotProps">{{ formatNumber(slotProps.data.previousCalls) }}</template>
          </Column>
        </DataTable>
        <!-- the period before holds calls for part of its days only (StarChat's `previousPartial`, rule 10) -->
        <p v-if="data.previousPartial === true" class="insights-note">{{ $t("components.callInsights.change.partialHelp") }}</p>
      </div>
    </template>
  </div>
</template>

<script>
import ColumnHelpList from "@/components/analytics/ColumnHelpList.vue";
import ColumnHelp from "@/components/analytics/ColumnHelp.vue";
import { cellLabel } from "@/utils/tableCells";
import CountLink from "@/components/analytics/CountLink.vue";

/**
 * "What the calls were about" (brief outcome 9, StarChat's analytics guide §11): one business's
 * topics, each with its calls in the period and in the previous one, beside the calls that have
 * topics at all (`callsWithTopics`, the base of the counts). StarChat reads topics for one business
 * only (a topic is that business's own vocabulary), so across several businesses the parent never
 * asks and passes `needsBusiness`, and the section says to choose one. Purely presentational, as the
 * other sections of these pages.
 */
export default {
  components: { ColumnHelpList, ColumnHelp, CountLink },
  props: {
    status: { type: String, required: true }, // loading | ok | absent | unavailable | needsBusiness
    data: { type: Object, default: null },
    // (kind, key) => the conversations list of the counted calls, or null (CallOutcomes.vue's `linkFor`)
    linkFor: { type: Function, default: null },
  },
  computed: {
    // Guards against a malformed or placeholder answer, the same way CallOutcomes.vue does.
    topics() {
      const list = this.data && this.data.topics;
      return Array.isArray(list) ? list : [];
    },
  },
  methods: {
    cellLabel,
    formatNumber(n) {
      return n == null ? "-" : n.toLocaleString();
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

.topics-base {
  color: @mrcall_grey_text;
  font-size: 14px;
  margin: 0 0 12px 0;
}

.table-container {
  overflow-x: auto;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
}

// Phones: the rows as cards, each value under its column's name (src/assets/style/tableCards.less, brief
// docs/briefs/2026-10-31-analytics-ux.md O4)
@media screen and (max-width: 640px) {
  .table-container :deep(table) {
    .table-cards();
  }
}
</style>
