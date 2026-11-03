<template>
  <section v-if="list.status !== 'absent'" class="analytics-section call-insights-section" aria-labelledby="config-title">
    <h3 id="config-title" class="section-title">{{ $t("components.callInsights.scope.configSuggestionsTitle") }}</h3>
    <p class="scope-label">{{ $t("components.callInsights.scope.allBusinesses") }}</p>
    <PagedTable
      :state="list"
      :columns="columns"
      :row-key="(row) => row.businessId"
      :caption="$t('components.callInsights.scope.configSuggestionsTitle')"
      :empty-text="$t('components.callInsights.scope.none')"
    >
      <template #cell-business="{ row }">
        <router-link :to="{ path: '/analytics', query: { id: row.businessId, tab: 'reports' } }">{{ label(row) }}</router-link>
        <span v-if="!row.name" class="scope-sub">{{ $t("components.callInsights.assistants.noName") }}</span>
      </template>
      <template #cell-periodEnd="{ row }">{{ day(row.periodEnd) }}</template>
      <template #cell-suggestions="{ row }">
        <ul class="scope-suggestions"><li v-for="(s, i) in row.suggestions" :key="i">{{ s }}</li></ul>
      </template>
    </PagedTable>
  </section>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import InsightsReports from "@/utils/InsightsReports";
import PagedTable from "@/components/analytics/PagedTable.vue";

/**
 * MrCall's own configuration suggestions, admin only (StarChat answers anyone else 404, and the section hides): one
 * page of businesses at a time, each from its latest report of the last 30 days, across the whole platform. It follows
 * none of the page's filters, and the page's filter bar says so while it is on screen (`in-view`).
 */
export default {
  components: { PagedTable },
  props: {
    ready: { type: Boolean, default: false },
  },
  emits: ["names", "error", "in-view"],
  data() {
    const user = () => this.$store.state.user;
    return {
      list: CallInsights.serverPage(
        ({ offset, size, asOf }) => CallInsights.configSuggestions(user(), undefined, { from: offset, size, asOf }),
        { onError: (error) => this.$emit("error", error, "config-suggestions") },
      ),
      started: false,
    };
  },
  computed: {
    columns() {
      const t = (k) => this.$t("components.callInsights.scope.columns." + k);
      return [
        { key: "business", label: t("business") },
        { key: "periodEnd", label: t("reportEnding") },
        { key: "suggestions", label: t("suggestions") },
      ];
    },
  },
  watch: {
    ready: { immediate: true, handler(value) { if (value && !this.started) { this.started = true; this.list.refresh(); } } },
    "list.items"(items) {
      const names = {};
      items.forEach((b) => { if (b.name) names[b.businessId] = b.name; });
      this.$emit("names", names);
    },
  },
  mounted() {
    if (typeof IntersectionObserver === "undefined") return;
    const thresholds = Array.from({ length: 21 }, (_, i) => i / 20);
    // Entered at 40% of the screen (or 60% of the section) and left only under 25% (or 40%). Without the gap the state
    // fed itself: the note it turns on can wrap the filter bar onto a second line, which moves the section by that line
    // (24 px on a tablet, more when the page is scrolled to its end and the bar's growth changes how far it can
    // scroll), back across a single threshold, so the note went off, the bar shrank, and the two alternated every
    // frame; the bar's buttons never stood still long enough to be clicked (found by the Analytics UX final review's
    // repairs, 2026-11-03, in tests/e2e/admin/analytics-insights.spec.js on the tablet). The gap, 15% of the screen,
    // is far larger than any line the note adds.
    let inView = false;
    this.observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      const screen = entry.rootBounds ? entry.rootBounds.height : window.innerHeight;
      const shown = entry.intersectionRect.height;
      const next = entry.isIntersecting && (inView
        ? shown >= 0.25 * screen || entry.intersectionRatio >= 0.4
        : shown >= 0.4 * screen || entry.intersectionRatio >= 0.6);
      if (next !== inView) {
        inView = next;
        this.$emit("in-view", inView);
      }
    }, { threshold: thresholds });
    if (this.$el && this.$el.nodeType === 1) this.observer.observe(this.$el);
  },
  beforeUnmount() {
    if (this.observer) this.observer.disconnect();
    this.$emit("in-view", false);
  },
  methods: {
    label(row) {
      return CallInsights.businessLabel(row.name, row.businessId);
    },
    day(ms) {
      return ms ? InsightsReports.dayLabel(ms, InsightsReports.FALLBACK_ZONE, this.$i18n.locale) : "–";
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.scope-label {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: @mrcall_grey_text;
}

.scope-sub {
  display: block;
  font-size: 12px;
  color: @mrcall_grey_text2;
}

.scope-suggestions {
  margin: 0;
  padding-left: 18px;
}
</style>
