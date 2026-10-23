<template>
  <div v-if="status !== 'absent'" class="analytics-section call-insights-section">
    <h3 class="section-title">{{ $t("components.callInsights.reports.title") }}</h3>
    <div v-if="status === 'unavailable'" class="insights-note">
      {{ $t("components.callInsights.notAvailableYet") }}
    </div>
    <div v-else-if="status === 'ok' && shownReports.length === 0" class="insights-note">
      {{ $t("components.callInsights.reports.none") }}
    </div>
    <template v-else-if="status === 'ok'">
      <div v-for="item in shownReports" :key="keyOf(item)" class="report-card" :data-report-key="keyOf(item)">
        <button type="button" class="report-header" :aria-expanded="isExpanded(item) ? 'true' : 'false'" @click="toggle(item)">
          <i :class="isExpanded(item) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" aria-hidden="true"></i>
          <span>{{ periodLabel(item) }}</span>
          <Tag v-if="onRequest(item)" severity="info" :value="$t('components.callInsights.reports.onRequest')" class="report-on-request" />
        </button>

        <div v-if="isExpanded(item) && item.content" class="report-body">
          <section v-if="item.content.topics && item.content.topics.length > 0" class="report-section">
            <h4 class="report-section-title">{{ $t("components.callInsights.reports.topicsTitle") }}</h4>
            <div v-for="topic in item.content.topics" :key="topic.topic" class="report-topic">
              <div class="report-topic-header">
                <span class="report-topic-name">{{ topic.topic }}</span>
                <Tag v-if="topic.new" severity="info" :value="$t('components.callInsights.reports.newTopic')" class="report-topic-new" />
              </div>
              <p v-if="labelsOf(topic).length > 0" class="report-topic-labels">
                {{ $t("components.callInsights.reports.themeIncludes", { labels: labelsOf(topic).join(", ") }) }}
              </p>
            </div>
          </section>

          <section v-if="item.content.gaps && item.content.gaps.length > 0" class="report-section">
            <h4 class="report-section-title">{{ $t("components.callInsights.reports.gapsTitle") }}</h4>
            <div v-for="(gap, idx) in item.content.gaps" :key="idx" class="report-gap">
              <span class="report-gap-group">{{ $t("components.callInsights.gaps." + gap.group) }}</span>
              <p class="report-gap-summary">{{ gap.summary }}</p>
              <!-- An example call is named by its place in the list: its id says nothing to a reader, and
                   stays in the link (and in the title, for whoever has to quote it). -->
              <div v-if="gap.examples && gap.examples.length > 0" class="report-gap-examples">
                <span class="report-gap-examples-label">{{ $t("components.callInsights.reports.examples") }}</span>
                <template v-for="(id, i) in gap.examples" :key="id">
                  <span v-if="i > 0">, </span>
                  <router-link v-if="isOwner" :to="conversationLink(id)" :title="id">{{ exampleName(i) }}</router-link>
                  <span v-else :title="id">{{ exampleName(i) }}</span>
                </template>
              </div>
            </div>
          </section>

          <section v-if="hasSuggestions(item.content)" class="report-section">
            <h4 class="report-section-title">{{ $t("components.callInsights.reports.suggestionsTitle") }}</h4>
            <div v-if="item.content.suggestions.business_info && item.content.suggestions.business_info.length > 0">
              <h5 class="report-suggestion-group">{{ $t("components.callInsights.reports.businessInfoTitle") }}</h5>
              <ul class="report-suggestion-list">
                <li v-for="(s, i) in item.content.suggestions.business_info" :key="i">{{ s }}</li>
              </ul>
            </div>
            <div v-if="item.content.suggestions.integration && item.content.suggestions.integration.length > 0">
              <h5 class="report-suggestion-group">{{ $t("components.callInsights.reports.integrationTitle") }}</h5>
              <ul class="report-suggestion-list">
                <li v-for="(s, i) in item.content.suggestions.integration" :key="i">{{ s }}</li>
              </ul>
            </div>
            <div v-if="isAdmin && item.content.suggestions.mrcall_config && item.content.suggestions.mrcall_config.length > 0">
              <h5 class="report-suggestion-group">{{ $t("components.callInsights.reports.mrcallConfigTitle") }}</h5>
              <ul class="report-suggestion-list">
                <li v-for="(s, i) in item.content.suggestions.mrcall_config" :key="i">{{ s }}</li>
              </ul>
            </div>
          </section>
        </div>
      </div>

      <button v-if="hasMore" type="button" class="call-toggle report-load-more" :disabled="loadingMore" @click="$emit('load-more')">
        <i :class="loadingMore ? 'pi pi-spin pi-spinner' : 'pi pi-angle-down'" aria-hidden="true"></i>
        {{ $t("components.callInsights.reports.loadMore") }}
      </button>
    </template>
  </div>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import { scrollBelowBar } from "@/utils/scrollBelowBar";

/**
 * A business's call reports of the period chosen at the top of the page (StarChat insights-backfill
 * brief, scope 7-9): the parent asks for the reports overlapping that period, automatic and asked for
 * an interval, newest first, and pages them on demand. The latest opens. A report shows only what the
 * model adds: its topics grouped into themes (each with the call topics it groups, and whether it is
 * new), the questions left unanswered grouped by reason with example calls, and the suggestions,
 * `mrcall_config` for an admin only (the server already strips it for anyone else; the same rule is kept
 * here, since a mocked or future answer could still carry it). Every number of the period (resolution,
 * message, booked, transferred, calls per topic, the calls worth reading) is the analytics' own, in the
 * sections above for the same period, and is not repeated here, although StarChat's content still carries
 * the counts until this dashboard is in production (StarChat plan B9b). A report asked for an interval is
 * marked as such; it can share its days with an automatic one, so a report is known by its start and its
 * request id together (`CallInsights.reportKey`). Example calls open for the business's owner only: a
 * reseller or an admin reading a managed owner's call is out of scope (StarChat, a Mycelium task).
 */
export default {
  props: {
    status: { type: String, required: true },
    reports: { type: Array, default: () => [] },
    hasMore: { type: Boolean, default: false },
    loadingMore: { type: Boolean, default: false },
    isOwner: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    businessId: { type: String, default: null },
    // The report a link asked to open (brief outcome 10: an integration's business opens at the
    // report that said it; `focusRequestId` for one asked for an interval), and that report when it is
    // not among the pages loaded.
    focusPeriod: { type: Number, default: null },
    focusRequestId: { type: String, default: null },
    focusedReport: { type: Object, default: null },
  },
  emits: ["load-more"],
  data() {
    return { expandedKeys: new Set() };
  },
  computed: {
    focusKey() {
      return this.focusPeriod == null ? null : CallInsights.reportKey({ periodStart: this.focusPeriod, requestId: this.focusRequestId });
    },
    // A focused report fetched on its own is shown first, and not again when a later page brings it.
    shownReports() {
      const extra = this.focusedReport;
      if (!extra) return this.reports;
      const key = CallInsights.reportKey(extra);
      return [extra, ...this.reports.filter((r) => CallInsights.reportKey(r) !== key)];
    },
  },
  watch: {
    shownReports: {
      immediate: true,
      handler(list) {
        this.applyFocus(list);
      },
    },
    focusKey() {
      this.focusShown = false;
      this.expandedKeys = new Set();
      this.applyFocus(this.shownReports);
    },
  },
  methods: {
    keyOf(item) {
      return CallInsights.reportKey(item);
    },
    onRequest(item) {
      return CallInsights.isOnRequest(item);
    },
    // The report a link named opens alone, scrolled into view once; without one, the latest opens.
    applyFocus(list) {
      if (!list || list.length === 0) return;
      const focused = this.focusKey != null && list.find((r) => this.keyOf(r) === this.focusKey);
      if (focused && !this.focusShown) {
        this.focusShown = true;
        const key = this.keyOf(focused);
        this.expandedKeys = new Set([key]);
        this.$nextTick(() => {
          const card = this.$el && this.$el.querySelector &&
            Array.from(this.$el.querySelectorAll(".report-card")).find((el) => el.dataset.reportKey === key);
          scrollBelowBar(card);
        });
        return;
      }
      if (this.focusKey != null) return;
      // A new period brings other reports: those open stay open only while listed, and with none of
      // them left the latest of the new list opens.
      const listed = new Set(list.map((r) => this.keyOf(r)));
      const kept = new Set([...this.expandedKeys].filter((k) => listed.has(k)));
      this.expandedKeys = kept.size > 0 ? kept : new Set([this.keyOf(list[0])]);
    },
    isExpanded(item) {
      return this.expandedKeys.has(this.keyOf(item));
    },
    toggle(item) {
      const key = this.keyOf(item);
      const next = new Set(this.expandedKeys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      this.expandedKeys = next;
    },
    periodLabel(item) {
      const from = item.content && item.content.period ? new Date(item.content.period.from) : new Date(item.periodStart);
      const to = item.content && item.content.period ? new Date(item.content.period.to) : new Date(item.periodEnd);
      return from.toLocaleDateString() + " – " + to.toLocaleDateString();
    },
    // The call topics a theme groups, as the model wrote them; a report of before has none.
    labelsOf(topic) {
      return Array.isArray(topic.labels) ? topic.labels.filter((l) => typeof l === "string" && l.trim() !== "") : [];
    },
    exampleName(index) {
      return this.$t("components.callInsights.reports.exampleCall", { n: index + 1 });
    },
    hasSuggestions(content) {
      const s = content.suggestions || {};
      return (s.business_info && s.business_info.length > 0) ||
        (s.integration && s.integration.length > 0) ||
        (this.isAdmin && s.mrcall_config && s.mrcall_config.length > 0);
    },
    conversationLink(conversationId) {
      return { path: "/conversations", query: { id: this.businessId, conversation: conversationId } };
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

.report-card {
  border: 1px solid @mrcall_borders;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 12px;
}

.report-header {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  padding: 0;
  font-size: 15px;
  font-weight: 600;
  color: @mrcall_dark_grey_text;
  cursor: pointer;
  width: 100%;
  text-align: left;
}

.report-body {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.report-section-title {
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: @mrcall_grey_text2;
}

.report-topic {
  margin-bottom: 10px;

  &:last-child {
    margin-bottom: 0;
  }
}

.report-topic-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.report-on-request {
  font-size: 11px;
}

.report-topic-labels {
  margin: 2px 0 0 0;
  font-size: 13px;
  color: @mrcall_grey_text;
}

.report-topic-name {
  font-weight: 600;
  color: @mrcall_dark_grey_text;
}

.report-gap {
  margin-bottom: 10px;

  &:last-child {
    margin-bottom: 0;
  }
}

.report-gap-group {
  font-weight: 600;
  color: @mrcall_dark_grey_text;
  font-size: 13px;
}

.report-gap-summary {
  margin: 2px 0;
  font-size: 14px;
  color: @mrcall_dark_grey_text;
}

.report-gap-examples {
  font-size: 13px;
  color: @mrcall_grey_text;
}

.report-gap-examples-label {
  margin-right: 4px;
}

.report-suggestion-group {
  margin: 8px 0 4px 0;
  font-size: 13px;
  font-weight: 600;
  color: @mrcall_grey_text2;
}

.report-suggestion-list {
  margin: 0;
  padding-left: 18px;
  font-size: 14px;
  color: @mrcall_dark_grey_text;
}

.report-load-more {
  margin-top: 4px;
}
</style>
