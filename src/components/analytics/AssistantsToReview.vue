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
          <Column>
            <template #header>
              <span class="assessed-header">
                {{ $t("components.callInsights.assistants.notSolved") }}
                <Tag severity="secondary" :value="$t('components.callInsights.assessedMarking')" class="insight-assessed-tag" />
              </span>
            </template>
            <template #body="slotProps">{{ shareOf(notSolvedCount(slotProps.data), slotProps.data.callsWithResolution) }}</template>
          </Column>
          <Column :header="$t('components.callInsights.assistants.unanswered')">
            <template #body="slotProps">{{ shareOf(slotProps.data.callsWithUnanswered, slotProps.data.callsWithUnansweredRecorded) }}</template>
          </Column>
          <Column :header="$t('components.callInsights.assistants.checks')">
            <template #body="slotProps">{{ shareOf(checksCount(slotProps.data), slotProps.data.callsWithChecks) }}</template>
          </Column>
          <Column :header="$t('components.callInsights.assistants.skillErrors')">
            <template #body="slotProps">{{ shareOf(slotProps.data.callsWithSkillErrors, slotProps.data.totalCalls) }}</template>
          </Column>
          <Column :header="$t('components.callInsights.assistants.extractionIssues')">
            <template #body="slotProps">{{ shareOf(slotProps.data.extractionsNotOk, slotProps.data.totalCalls) }}</template>
          </Column>
        </DataTable>
      </div>
    </template>
  </div>
</template>

<script>
import CallInsights from "@/utils/CallInsights";

/**
 * The per-business signals, sorted to find the assistants to review (brief outcome 5): admin and
 * reseller only (StarChat answers any other role 404, which the parent reads as an absent
 * section). Every share here is the exact formula StarChat sorts by
 * (`CallInsightsAnalytics.sorted` in the StarChat repository), so the column a business is sorted
 * on always matches what the column shows. "Not solved" (the share of `unresolved` and
 * `caller_left` among the calls with a resolution, `callsWithResolution`) is marked assessed, in
 * its header and its sort option, since the resolution is the assistant's own judgement.
 */
const NOT_SOLVED_KEYS = ["unresolved", "caller_left"];

export default {
  props: {
    status: { type: String, required: true },
    data: { type: Object, default: null },
    sort: { type: String, required: true },
  },
  emits: ["sort-change", "select-business"],
  computed: {
    // Guards against a malformed or placeholder answer (an empty array, from a test's generic
    // fallback), the same way WhatCallsSaid.vue and CallQuality.vue do.
    businesses() {
      return (this.data && this.data.businesses) || [];
    },
    sortOptions() {
      return [
        { value: "calls", label: this.$t("components.callInsights.assistants.sortOptions.calls") },
        { value: "not_solved", label: this.$t("components.callInsights.assistants.sortOptions.notSolved") },
        { value: "unanswered", label: this.$t("components.callInsights.assistants.sortOptions.unanswered") },
        { value: "checks", label: this.$t("components.callInsights.assistants.sortOptions.checks") },
        { value: "skill_errors", label: this.$t("components.callInsights.assistants.sortOptions.skillErrors") },
        { value: "extraction_failures", label: this.$t("components.callInsights.assistants.sortOptions.extractionFailures") },
      ];
    },
  },
  methods: {
    notSolvedCount(row) {
      return NOT_SOLVED_KEYS.reduce((sum, key) => sum + ((row.resolution && row.resolution[key]) || 0), 0);
    },
    checksCount(row) {
      const checks = row.checks || {};
      return CallInsights.CHECK_KEYS.reduce((sum, key) => sum + (checks[key] || 0), 0);
    },
    shareOf(count, of) {
      const safeCount = count || 0;
      const percent = of > 0 ? Math.round((safeCount / of) * 100) : 0;
      return this.$t("components.callInsights.assistants.shareOfTotal", { percent, count: safeCount, total: of || 0 });
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
