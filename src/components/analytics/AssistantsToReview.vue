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
          <!-- two businesses of one name are told apart by a short id (U19c m11) -->
          <span v-else-if="sharedNames.has(row.businessName)" class="assistant-business-id">{{ shortId(row.businessId) }}</span>
        </span>
      </template>
      <template #cell-calls="{ row }">{{ row.totalCalls }}</template>
      <template v-for="column in shareColumns" :key="column.sort" #[cellSlot(column)]="{ row }">
        <span v-if="shareOf(row, column.sort).percent === null" class="assistant-share">—</span>
        <span v-else class="assistant-share">
          <span class="assistant-share-percent">{{ shareOf(row, column.sort).percent }}</span>{{ " " }}<span class="assistant-share-base">{{ shareOf(row, column.sort).of }}</span>
        </span>
      </template>
      <template #cell-change="{ row }">
        <NotAvailable v-if="changeOf(row).reason" :change="{ available: false, reason: changeOf(row).reason }" />
        <span v-else>{{ changeOf(row).text }}</span>
      </template>
      <!-- what the business's callers ask most, each opening its requests for that business with all outcomes, and
           its latest report beside (the amendment of 2026-10-30, rule 3) -->
      <template #cell-asks="{ row }">
        <ul v-if="asksOf(row).length" class="assistant-asks">
          <li v-for="c in asksOf(row)" :key="c.category">
            <button
              type="button"
              class="assistant-ask"
              :aria-label="$t('components.callInsights.assistants.askedOf', { category: c.label, n: c.count }, c.count)"
              :aria-expanded="isAskOpen(row, c) ? 'true' : 'false'"
              :aria-controls="asksRegion(row)"
              @click="toggleAsk(row, c)"
            >{{ c.label }} <strong>{{ c.count }}</strong></button>
          </li>
        </ul>
        <span v-else>–</span>
        <router-link v-if="row.latestReport && row.latestReport.periodStart != null" :to="latestReportLink(row)" class="assistant-report">
          {{ $t("components.callInsights.assistants.latestReport") }}
        </router-link>
      </template>
      <template #after-row="{ row, colspan }">
        <tr v-if="openAsk && openAsk.businessId === row.businessId" class="assistant-asks-expansion">
          <td :id="asksRegion(row)" :colspan="colspan">
            <CategoryRequests
              :category="openAsk.category"
              :label="openAsk.label"
              :body="body"
              :business-id="row.businessId"
              :all="true"
            />
          </td>
        </tr>
      </template>
      <template #cell-suggestions="{ row }">{{ typeof row.configSuggestions === "number" ? row.configSuggestions : "–" }}</template>
      <template #cell-health="{ row }">
        <span class="assistant-health">
          <span v-for="word in healthOf(row)" :key="word" class="assistant-health-flag">{{ word }}</span>
        </span>
      </template>
    </PagedTable>
    <dl class="assistants-legend" :aria-label="$t('components.callInsights.assistants.legendTitle')">
      <dt>{{ $t("components.callInsights.assistants.short.change") }}</dt>
      <dd>{{ $t("components.callInsights.assistants.legend.change") }}</dd>
      <template v-if="showSuggestions">
        <dt>{{ $t("components.callInsights.assistants.short.configSuggestions") }}</dt>
        <dd>{{ $t("components.callInsights.assistants.legend.configSuggestions") }}</dd>
      </template>
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
import InsightsReports from "@/utils/InsightsReports";
import PagedTable from "@/components/analytics/PagedTable.vue";
import CategoryRequests from "@/components/analytics/CategoryRequests.vue";
import NotAvailable from "@/components/analytics/NotAvailable.vue";

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
  components: { PagedTable, CategoryRequests, NotAvailable },
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
      // the category of a row whose requests are open under it: {businessId, category, label}
      openAsk: null,
    };
  },
  computed: {
    showSuggestions() {
      return this.table.items.some((row) => typeof row.configSuggestions === "number");
    },
    // the company names that more than one row of the page carries
    sharedNames() {
      const seen = new Map();
      this.table.items.forEach((row) => { if (row.businessName) seen.set(row.businessName, (seen.get(row.businessName) || 0) + 1); });
      return new Set([...seen].filter(([, n]) => n > 1).map(([name]) => name));
    },
    shareColumns() {
      return SHARE_COLUMNS;
    },
    columns() {
      const short = (label) => this.$t("components.callInsights.assistants.short." + label);
      return [
        { key: "business", label: this.$t("components.callInsights.assistants.businessId"), class: "assistant-business-column" },
        { key: "calls", label: short("calls"), sortKey: "calls" },
        ...SHARE_COLUMNS.map((c) => ({ key: c.sort, label: short(c.label) + (c.assessed ? " (" + this.$t("components.callInsights.assistants.assessedShort") + ")" : ""), sortKey: c.sort })),
        // "Non risolte" against the period before, beside the shares (not a server sort)
        { key: "change", label: short("change") },
        { key: "asks", label: short("asks"), class: "assistant-asks-column" },
        // MrCall's configuration suggestions: an admin's only (StarChat sends them to no one else)
        ...(this.showSuggestions ? [{ key: "suggestions", label: short("configSuggestions") }] : []),
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
    // A share in two lines, its percent over its count of its base; a base of 0 is no share at all, a dash (U19c m11:
    // "0% (0 di 0)"), as is a server without `notSolved` (before StarChat's F3), never 0%.
    shareOf(row, sort) {
      if (sort === "not_solved" && typeof row.notSolved !== "number") return { percent: null };
      const { count, base, percent } = CallInsights.assistantShare(row, sort);
      if (!(base > 0)) return { percent: null };
      return { percent: percent + "%", of: this.$t("components.callInsights.assistants.countOf", { count, total: base }) };
    },
    // "Non risolte" against the period before: "n.d." with its reason over fewer than 20 calls with a request then
    // (U19 M13) or over a previous window with calls for part of its days (the amendment of 2026-10-30, rule 10).
    changeOf(row) {
      const na = (reason) => ({ text: this.$t("components.callInsights.change.notAvailable"), reason });
      if (InsightsReports.previousPartial(row)) return na("partial");
      const before = row.previousCallsWithRequest;
      if (typeof before === "number" && before > 0 && before < InsightsReports.MIN_PREVIOUS_BASE) return na("base");
      const points = CallInsights.notSolvedChange(row);
      if (points === null) return { text: "–" };
      const sign = points > 0 ? "+" : points < 0 ? "−" : "±";
      return { text: this.$t("components.callInsights.assistants.changePoints", { sign, n: Math.abs(points) }) };
    },
    shortId(id) {
      return String(id || "").slice(0, 8);
    },
    // The business's top request categories as StarChat answers them (`requestCategories`, each counting its requests
    // as `questions`): the one place this field is read.
    asksOf(row) {
      const list = Array.isArray(row.requestCategories) ? row.requestCategories : [];
      return list.filter((c) => c && typeof c.category === "string" && typeof c.questions === "number")
        .slice(0, 3).map((c) => ({ category: c.category, label: c.label || c.category, count: c.questions }));
    },
    // the cell a row's category requests open in, named by the buttons that open it
    asksRegion(row) {
      return "assistant-asks-" + String(row.businessId).replace(/[^A-Za-z0-9_-]/g, "-");
    },
    isAskOpen(row, c) {
      return !!this.openAsk && this.openAsk.businessId === row.businessId && this.openAsk.category === c.category;
    },
    toggleAsk(row, c) {
      this.openAsk = this.isAskOpen(row, c) ? null : { businessId: row.businessId, category: c.category, label: c.label };
    },
    // StarChat's latest report of any kind (`AssistantLatestReport`): a requested one is read by its `requestId`, else the
    // automatic report at that start would be opened, or none (U19r6b M1)
    latestReportLink(row) {
      const r = row.latestReport;
      const query = { id: row.businessId, start: String(r.periodStart) };
      if (typeof r.requestId === "string" && r.requestId !== "") query.requestId = r.requestId;
      return { path: "/analytics/report", query };
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
  display: flex;
  flex-direction: column;
  white-space: nowrap;
}

.assistant-share-base {
  font-size: 12px;
  color: @mrcall_grey_text;
}

.assistant-asks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.assistant-ask {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: @mrcall_blue;
  text-align: left;
  cursor: pointer;
  text-decoration: underline;
}

.assistant-report {
  display: inline-block;
  margin-top: 4px;
  font-size: 13px;
}

// The table fits its card at 1440 px (U19c m12: 1358 px of table in 926 px): headers wrap, a share is two lines, the
// cells' side padding halved; the page around it is the wide one
:deep(.paged-table-table th) {
  white-space: normal;
}

@media screen and (min-width: 641px) {
  :deep(.paged-table-table th), :deep(.paged-table-table td) {
    padding-left: 4px;
    padding-right: 4px;
  }
}

.assistant-health {
  white-space: normal;
}

:deep(.assistant-asks-column) {
  min-width: 130px;
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
  min-width: 130px;
}

</style>
