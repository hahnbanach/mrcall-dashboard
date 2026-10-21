<template>
  <div v-if="status !== 'absent'" class="analytics-section call-insights-section">
    <h3 class="section-title">{{ $t("components.callInsights.reports.title") }}</h3>
    <div v-if="status === 'unavailable'" class="insights-note">
      {{ $t("components.callInsights.notAvailableYet") }}
    </div>
    <div v-else-if="status === 'ok' && reports.length === 0" class="insights-note">
      {{ $t("components.callInsights.reports.none") }}
    </div>
    <template v-else-if="status === 'ok'">
      <div v-for="item in reports" :key="item.periodStart" class="report-card">
        <button type="button" class="report-header" :aria-expanded="isExpanded(item.periodStart) ? 'true' : 'false'" @click="toggle(item.periodStart)">
          <i :class="isExpanded(item.periodStart) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" aria-hidden="true"></i>
          <span>{{ periodLabel(item) }}</span>
        </button>

        <div v-if="isExpanded(item.periodStart) && item.content" class="report-body">
          <section v-if="hasSummary(item.content)" class="report-summary report-section">
            <h4 class="report-section-title">{{ $t("components.callInsights.reports.summaryTitle") }}</h4>
            <div v-if="resolutionKeys(item.content).length > 0" class="report-topic-outcomes">
              <span v-for="key in resolutionKeys(item.content)" :key="key" class="report-topic-outcome">
                <InsightLabel dimension="resolution" :value="key" />
                <span class="report-topic-outcome-count">{{ item.content.resolution[key] }}</span>
              </span>
            </div>
            <div v-if="messageKeys(item.content).length > 0" class="report-topic-outcomes">
              <span v-for="key in messageKeys(item.content)" :key="key" class="report-topic-outcome">
                <InsightLabel dimension="message" :value="key" />
                <span class="report-topic-outcome-count">{{ item.content.message[key] }}</span>
              </span>
            </div>
            <p v-if="isCount(item.content.booked)" class="report-fact">
              {{ $t("components.callInsights.reports.booked", { count: item.content.booked }) }}
            </p>
            <p v-if="isCount(item.content.transferred)" class="report-fact">
              {{ $t("components.callInsights.reports.transferred", { count: item.content.transferred }) }}
            </p>
          </section>

          <section v-if="item.content.topics && item.content.topics.length > 0" class="report-section">
            <h4 class="report-section-title">{{ $t("components.callInsights.reports.topicsTitle") }}</h4>
            <div v-for="topic in item.content.topics" :key="topic.topic" class="report-topic">
              <div class="report-topic-header">
                <span class="report-topic-name">{{ topic.topic }}</span>
                <Tag v-if="topic.new" severity="info" :value="$t('components.callInsights.reports.newTopic')" class="report-topic-new" />
                <span class="report-topic-share">{{ topicShare(topic, item.content) }}</span>
              </div>
              <div class="report-topic-outcomes">
                <span v-for="key in resolutionKeys(topic)" :key="key" class="report-topic-outcome">
                  <InsightLabel dimension="resolution" :value="key" />
                  <span class="report-topic-outcome-count">{{ topic.resolution[key] }}</span>
                </span>
              </div>
            </div>
          </section>

          <section v-if="item.content.gaps && item.content.gaps.length > 0" class="report-section">
            <h4 class="report-section-title">{{ $t("components.callInsights.reports.gapsTitle") }}</h4>
            <div v-for="(gap, idx) in item.content.gaps" :key="idx" class="report-gap">
              <span class="report-gap-group">{{ $t("components.callInsights.gaps." + gap.group) }}</span>
              <p class="report-gap-summary">{{ gap.summary }}</p>
              <div v-if="gap.examples && gap.examples.length > 0" class="report-gap-examples">
                <template v-for="(id, i) in gap.examples" :key="id">
                  <span v-if="i > 0">, </span>
                  <router-link v-if="isOwner" :to="conversationLink(id)">{{ id }}</router-link>
                  <span v-else>{{ id }}</span>
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

          <section v-if="item.content.flagged_calls && item.content.flagged_calls.length > 0" class="report-section">
            <h4 class="report-section-title">{{ $t("components.callInsights.reports.flaggedTitle") }}</h4>
            <div class="report-gap-examples">
              <template v-for="(id, i) in item.content.flagged_calls" :key="id">
                <span v-if="i > 0">, </span>
                <router-link v-if="isOwner" :to="conversationLink(id)">{{ id }}</router-link>
                <span v-else>{{ id }}</span>
              </template>
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
import InsightLabel from "@/components/analytics/InsightLabel.vue";

/**
 * A business's call reports (brief outcome 4): the latest one open, earlier ones by `before`
 * paging (the parent reads it from the last loaded item's `periodEnd`); topics with their share
 * and whether they are new, and the period's resolution, message, booked and transferred counts,
 * each under the same value table as the rest of the dashboard; the
 * unanswered questions grouped by reason; the suggestions, `mrcall_config` for an admin only
 * (the server already strips it for anyone else; this is the same rule kept on the client, since a
 * mocked or future answer could still carry it). A report's example calls and the flagged calls
 * open for the business's owner only: a reseller or an admin reading a managed owner's call is out
 * of scope (StarChat, a Mycelium task).
 */
export default {
  components: { InsightLabel },
  props: {
    status: { type: String, required: true },
    reports: { type: Array, default: () => [] },
    hasMore: { type: Boolean, default: false },
    loadingMore: { type: Boolean, default: false },
    isOwner: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    businessId: { type: String, default: null },
  },
  emits: ["load-more"],
  data() {
    return { expandedPeriods: new Set() };
  },
  watch: {
    reports: {
      immediate: true,
      handler(list) {
        if (list && list.length > 0 && this.expandedPeriods.size === 0) {
          this.expandedPeriods = new Set([list[0].periodStart]);
        }
      },
    },
  },
  methods: {
    isExpanded(periodStart) {
      return this.expandedPeriods.has(periodStart);
    },
    toggle(periodStart) {
      const next = new Set(this.expandedPeriods);
      if (next.has(periodStart)) next.delete(periodStart);
      else next.add(periodStart);
      this.expandedPeriods = next;
    },
    periodLabel(item) {
      const from = item.content && item.content.period ? new Date(item.content.period.from) : new Date(item.periodStart);
      const to = item.content && item.content.period ? new Date(item.content.period.to) : new Date(item.periodEnd);
      return from.toLocaleDateString() + " – " + to.toLocaleDateString();
    },
    topicShare(topic, content) {
      const total = content.calls || 0;
      const pct = total > 0 ? Math.round((topic.calls / total) * 100) : 0;
      return this.$t("components.callInsights.reports.topicShare", { calls: topic.calls, percent: pct });
    },
    // A report's `resolution` and `message` are code -> count maps, in a topic and over the
    // period. A report written before insights version 2 carries `outcomes` instead and shows none
    // of the four.
    resolutionKeys(holder) {
      const counts = holder.resolution || {};
      return CallInsights.RESOLUTION_KEYS.filter((key) => counts[key]);
    },
    messageKeys(holder) {
      const counts = holder.message || {};
      return CallInsights.MESSAGE_KEYS.filter((key) => counts[key]);
    },
    isCount(value) {
      return typeof value === "number";
    },
    hasSummary(content) {
      return this.resolutionKeys(content).length > 0 || this.messageKeys(content).length > 0 ||
        this.isCount(content.booked) || this.isCount(content.transferred);
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

.report-topic-name {
  font-weight: 600;
  color: @mrcall_dark_grey_text;
}

.report-topic-share {
  color: @mrcall_grey_text;
  font-size: 13px;
}

.report-topic-outcomes {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 4px;
}

.report-topic-outcome {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: @mrcall_grey_text;
}

.report-fact {
  margin: 6px 0 0 0;
  font-size: 13px;
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
