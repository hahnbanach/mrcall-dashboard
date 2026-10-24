<template>
  <section v-if="table.status !== 'absent'" class="analytics-section call-insights-section assistants-section" aria-labelledby="assistants-title">
    <h3 id="assistants-title" class="section-title">{{ $t("components.callInsights.assistants.title") }}</h3>
    <form class="assistants-sort" role="search" @submit.prevent="applySearch">
      <Button
        v-if="selectedBusinessId"
        type="button"
        size="small"
        severity="secondary"
        icon="pi pi-times"
        class="assistants-clear"
        :label="$t('components.callInsights.assistants.showAll')"
        @click="$emit('clear-business')"
      />
      <InputText
        v-model="searchInput"
        type="search"
        :aria-label="$t('components.callInsights.assistants.search')"
        :placeholder="$t('components.callInsights.assistants.search')"
        class="assistants-search"
      />
      <Button type="submit" size="small" outlined icon="pi pi-search" :label="$t('components.callInsights.assistants.searchButton')" />
      <Button
        v-if="search"
        type="button" size="small" text icon="pi pi-times"
        :label="$t('components.callInsights.assistants.clearSearch', { term: search })"
        @click="clearSearch"
      />
    </form>
    <PagedTable
      :state="table"
      :columns="columns"
      :row-key="(row) => row.businessId"
      :row-class="(row) => (row.businessId === selectedBusinessId ? 'assistant-selected' : null)"
      :caption="$t('components.callInsights.assistants.title')"
      :empty-text="search ? $t('components.callInsights.assistants.noneFound', { term: search }) : $t('components.callInsights.assistants.none')"
    >
      <template #cell-business="{ row }">
        <span class="assistant-business">
          <button
            type="button"
            class="assistant-business-name"
            :aria-pressed="row.businessId === selectedBusinessId ? 'true' : 'false'"
            @click="$emit('select-business', row.businessId)"
          >{{ businessLabel(row) }}</button>
          <span v-if="!row.businessName" class="assistant-business-id">{{ $t("components.callInsights.assistants.noName") }}</span>
        </span>
      </template>
      <template #cell-calls="{ row }">{{ row.totalCalls }}</template>
      <template v-for="column in shareColumns" :key="column.sort" #[cellSlot(column)]="{ row }">
        <span class="assistant-share">{{ shareOf(row, column.sort) }}</span>
      </template>
      <template #cell-health="{ row }">
        <span class="assistant-health">
          <span v-for="word in healthOf(row)" :key="word" class="assistant-health-flag">{{ word }}</span>
        </span>
      </template>
    </PagedTable>
    <dl class="assistants-legend" :aria-label="$t('components.callInsights.assistants.legendTitle')">
      <template v-for="column in shareColumns" :key="column.sort">
        <dt>{{ $t("components.callInsights.assistants.short." + column.label) }}</dt>
        <dd>
          {{ $t("components.callInsights.assistants." + column.label) }}<span v-if="column.assessed">
            ({{ $t("components.callInsights.assessedMarking") }})</span>: {{ $t("components.callInsights.assistants.legend." + column.label) }}
        </dd>
      </template>
    </dl>
  </section>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import PagedTable from "@/components/analytics/PagedTable.vue";

/**
 * "Assistenti da rivedere" (docs/briefs/2026-10-24-insights-reports-ux.md in StarChat): the per-business signals,
 * server-paged with their total, sortable on every header (StarChat sorts, `aria-sort` says the order), searched by
 * company name, each business with its account health in words (no amount). Admin and reseller only (StarChat answers
 * anyone else 404, and the section hides). Every share is the one StarChat sorts by, over the base the row returns
 * beside its count (`CallInsights.assistantShare`); "Non risolte" is StarChat's `notSolved` over `callsWithRequest`
 * (unresolved, and requests passed on with an incomplete message). A business's name selects it: the page narrows to
 * it, and the control above the table widens it again. The table follows the page's filters (`body`).
 */
const SHARE_LABELS = {
  not_solved: { label: "notSolved", assessed: true },
  caller_silent: { label: "callerSilent", assessed: false },
  not_answered: { label: "notAnswered", assessed: false },
  caller_left: { label: "callerLeft", assessed: true },
  unanswered: { label: "unanswered", assessed: false },
  checks: { label: "checks", assessed: false },
  skill_errors: { label: "skillErrors", assessed: false },
  extraction_failures: { label: "extractionIssues", assessed: false },
};
const SHARE_COLUMNS = CallInsights.ASSISTANT_SORT_KEYS
  .filter((sort) => sort !== "calls")
  .map((sort) => ({ sort, ...SHARE_LABELS[sort] }));

export default {
  components: { PagedTable },
  props: {
    // the page's filters, as every other section sends them
    body: { type: Object, default: null },
    // the business the page is narrowed to, marked in the table; null for none
    selectedBusinessId: { type: String, default: null },
  },
  emits: ["select-business", "clear-business", "names", "error"],
  data() {
    const user = () => this.$store.state.user;
    return {
      table: CallInsights.serverPage(
        ({ offset, size, sort, direction }) => CallInsights.assistants(user(), this.body || {}, { sort, direction, from: offset, size, search: this.search || undefined }),
        { sort: "not_solved", direction: "desc", read: (answer) => CallInsights.pageOf(answer, "businesses"), onError: (error) => this.$emit("error", error, "assistants") },
      ),
      searchInput: "",
      search: "",
    };
  },
  computed: {
    shareColumns() {
      return SHARE_COLUMNS;
    },
    columns() {
      const short = (label) => this.$t("components.callInsights.assistants.short." + label);
      return [
        { key: "business", label: this.$t("components.callInsights.assistants.businessId"), class: "assistant-business-column" },
        { key: "calls", label: short("calls"), sortKey: "calls" },
        ...SHARE_COLUMNS.map((c) => ({ key: c.sort, label: short(c.label) + (c.assessed ? " (" + this.$t("components.callInsights.assistants.assessedShort") + ")" : ""), sortKey: c.sort })),
        { key: "health", label: this.$t("components.callInsights.assistants.healthTitle") },
      ];
    },
  },
  watch: {
    body: {
      deep: true,
      handler(value) { if (value) this.table.refresh(); },
    },
    // The names this table knows, for the page's filter bar.
    "table.items"(rows) {
      const names = {};
      rows.forEach((row) => { if (row.businessName) names[row.businessId] = row.businessName; });
      this.$emit("names", names);
    },
  },
  mounted() {
    if (this.body) this.table.refresh();
  },
  methods: {
    cellSlot(column) {
      return "cell-" + column.sort;
    },
    businessLabel(row) {
      return CallInsights.businessLabel(row.businessName, row.businessId);
    },
    shareOf(row, sort) {
      const { count, base, percent } = CallInsights.assistantShare(row, sort);
      return this.$t("components.callInsights.assistants.shareOfTotal", { percent, count, total: base });
    },
    // The account in words, no amount: a debt or low credit, and the plan's state when it is not plainly active
    // (named as the plan page names it); "In regola" when none applies.
    healthOf(row) {
      const h = row.accountHealth;
      if (!h) return [this.$t("components.callInsights.assistants.health.unknown")];
      const words = [];
      if (h.inDebt) words.push(this.$t("components.callInsights.assistants.health.inDebt"));
      else if (h.creditLow) words.push(this.$t("components.callInsights.assistants.health.creditLow"));
      const plan = h.subscriptionStatus;
      if (plan && plan !== "ACTIVE") {
        const key = "components.businesses.form.subscriptionStatusLabels." + plan;
        words.push(this.$te(key) ? this.$t(key) : this.$t("components.callInsights.assistants.health.planOther"));
      }
      return words.length ? words : [this.$t("components.callInsights.assistants.health.ok")];
    },
    applySearch() {
      this.search = this.searchInput.trim();
      this.table.refresh();
    },
    clearSearch() {
      this.searchInput = "";
      this.search = "";
      this.table.refresh();
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
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.assistants-sort-select {
  max-width: 100%;
}

.assistant-share {
  white-space: nowrap;
}

.assistant-business {
  display: flex;
  flex-direction: column;
}

.assistant-business-name {
  font-weight: 600;
}

.assistant-business-id {
  font-size: 12px;
  color: @mrcall_grey_text2;
}

.table-container {
  overflow-x: auto;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
}

.assistant-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.assistants-legend {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 12px;
  margin: 12px 0 0 0;
  font-size: 13px;
  color: @mrcall_grey_text;

  dt {
    font-weight: 600;
    color: @mrcall_dark_grey_text;
  }

  dd {
    margin: 0;
  }
}

// The frozen column needs an opaque background, or the shares show through it as they scroll under:
// the header cell its own (its row has none), a body cell its row's (striped, selected).
.assistant-business-name {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: @mrcall_blue;
  text-align: left;
  cursor: pointer;
  text-decoration: underline;
}

.assistants-search {
  min-width: 220px;
}

.assistant-health {
  display: flex;
  flex-direction: column;
  gap: 2px;
  white-space: nowrap;
}

:deep(tr.assistant-selected td), :deep(tr.assistant-selected td.assistant-business-column) {
  background: @mrcall_bluette;
}

// The business stays in view while the shares scroll sideways (the review of D12); not on a phone, where the rows
// are cards.
@media screen and (min-width: 641px) {
  :deep(th.assistant-business-column), :deep(td.assistant-business-column) {
    position: sticky;
    left: 0;
    z-index: 1;
    background: @mrcall_white;
  }
}

:deep(.assistant-business-column) {
  min-width: 160px;
}

</style>
