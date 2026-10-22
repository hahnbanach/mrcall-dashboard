<template>
  <div v-if="status !== 'absent'" class="analytics-section call-insights-section">
    <h3 class="section-title">{{ $t("components.callInsights.assistants.title") }}</h3>
    <div v-if="status === 'unavailable'" class="insights-note">
      {{ $t("components.callInsights.notAvailableYet") }}
    </div>
    <template v-else-if="status === 'ok' && data">
      <div class="assistants-sort">
        <label class="filter-label">{{ $t("components.callInsights.assistants.sortLabel") }}</label>
        <Dropdown
          :modelValue="sort"
          :options="sortOptions"
          optionLabel="label"
          optionValue="value"
          :ariaLabel="$t('components.callInsights.assistants.sortLabel')"
          @update:modelValue="$emit('sort-change', $event)"
        />
      </div>
      <div class="table-container">
        <DataTable
          :value="businesses"
          :rows="10"
          :paginator="businesses.length > 10"
          stripedRows
          selectionMode="single"
          @row-select="onRowSelect"
        >
          <Column field="businessId" :header="$t('components.callInsights.assistants.businessId')" />
          <Column :header="$t('components.callInsights.assistants.calls')">
            <template #body="slotProps">{{ slotProps.data.totalCalls }}</template>
          </Column>
          <Column v-for="column in shareColumns" :key="column.sort">
            <template #header>
              <span :class="{ 'assessed-header': column.assessed }">
                {{ $t("components.callInsights.assistants." + column.label) }}
                <Tag v-if="column.assessed" severity="secondary" :value="$t('components.callInsights.assessedMarking')" class="insight-assessed-tag" />
              </span>
            </template>
            <template #body="slotProps">{{ shareOf(slotProps.data, column.sort) }}</template>
          </Column>
        </DataTable>
      </div>
    </template>
  </div>
</template>

<script>
import CallInsights from "@/utils/CallInsights";

/**
 * The per-business signals, sorted to find the assistants to review (brief outcomes 5 and 9): admin
 * and reseller only (StarChat answers any other role 404, which the parent reads as an absent
 * section). Every share here is the one StarChat sorts by, over the base the row returns beside its
 * count (`CallInsights.assistantShare`), so the column a business is sorted on always matches what
 * the column shows. "Unresolved" (`unresolved` over `callsWithRequest`) and "caller left" (over
 * `callsWithResolution`) are marked assessed, in their headers and sort options, since the
 * resolution is the assistant's own judgement; `caller_silent` and `not_answered` are facts.
 */
// How each share is headed and offered as a sort; the columns follow StarChat's sort keys, in the
// order `CallInsights.ASSISTANT_SORT_KEYS` holds them (`calls` is the plain count column).
const SHARE_LABELS = {
  not_solved: { label: "notSolved", option: "notSolved", assessed: true },
  caller_silent: { label: "callerSilent", option: "callerSilent", assessed: false },
  not_answered: { label: "notAnswered", option: "notAnswered", assessed: false },
  caller_left: { label: "callerLeft", option: "callerLeft", assessed: true },
  unanswered: { label: "unanswered", option: "unanswered", assessed: false },
  checks: { label: "checks", option: "checks", assessed: false },
  skill_errors: { label: "skillErrors", option: "skillErrors", assessed: false },
  extraction_failures: { label: "extractionIssues", option: "extractionFailures", assessed: false },
};
const SHARE_COLUMNS = CallInsights.ASSISTANT_SORT_KEYS
  .filter((sort) => sort !== "calls")
  .map((sort) => ({ sort, ...SHARE_LABELS[sort] }));

export default {
  props: {
    status: { type: String, required: true },
    data: { type: Object, default: null },
    sort: { type: String, required: true },
  },
  emits: ["sort-change", "select-business"],
  computed: {
    // Guards against a malformed or placeholder answer (an empty array, from a test's generic
    // fallback), the same way CallOutcomes.vue and CallQuality.vue do.
    businesses() {
      return (this.data && this.data.businesses) || [];
    },
    shareColumns() {
      return SHARE_COLUMNS;
    },
    sortOptions() {
      return [
        { value: "calls", label: this.$t("components.callInsights.assistants.sortOptions.calls") },
        ...SHARE_COLUMNS.map((column) => ({
          value: column.sort,
          label: this.$t("components.callInsights.assistants.sortOptions." + column.option),
        })),
      ];
    },
  },
  methods: {
    shareOf(row, sort) {
      const { count, base, percent } = CallInsights.assistantShare(row, sort);
      return this.$t("components.callInsights.assistants.shareOfTotal", { percent, count, total: base });
    },
    onRowSelect(event) {
      this.$emit("select-business", event.data.businessId);
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

.assistants-sort {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.table-container {
  overflow-x: auto;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
}

.assessed-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.insight-assessed-tag {
  font-size: 10px;
  font-weight: 600;
}
</style>
