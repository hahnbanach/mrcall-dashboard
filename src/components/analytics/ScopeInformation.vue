<template>
  <div v-if="integrations.status !== 'absent'" class="analytics-section call-insights-section">
    <h3 class="section-title">{{ $t("components.callInsights.scope.title") }}</h3>
    <p class="scope-label">{{ $t("components.callInsights.scope.allBusinesses") }}</p>

    <div v-if="integrations.status === 'loading'" class="insights-note" role="status">
      {{ $t("components.callInsights.scope.loading") }}
    </div>
    <div v-else-if="integrations.status === 'unavailable'" class="insights-note">
      {{ $t("components.callInsights.notAvailableYet") }}
    </div>
    <template v-else-if="integrations.status === 'ok'">
      <div v-if="integrations.items.length === 0" class="insights-note">{{ $t("components.callInsights.scope.none") }}</div>
      <ul v-else class="scope-list scope-card" :aria-label="$t('components.callInsights.scope.title')">
        <li v-for="item in integrations.items" :key="integrationKey(item)" class="scope-item">
          <div class="scope-item-head">
            <span class="scope-item-text">{{ item.text }}</span>
            <span class="scope-item-counts">{{ counts(item) }}</span>
          </div>
          <div class="scope-item-meta">
            <Tag v-if="kindLabel(item.kind)" severity="secondary" :value="kindLabel(item.kind)" class="scope-kind" />
            <span v-if="templateNames[item.template]" class="scope-template">
              {{ $t("components.callInsights.scope.template", { template: templateLabel(item.template) }) }}
            </span>
          </div>
          <div v-if="saidBy(item).said.length > 0 || saidBy(item).more > 0" class="scope-said">
            <span class="scope-said-label">{{ $t("components.callInsights.scope.saidByLabel") }}</span>
            <router-link
              v-for="who in saidBy(item).said"
              :key="who.businessId"
              :to="businessLink(who.businessId, who.reportPeriodStart)"
              class="scope-business-link"
            >{{ label(who.name, who.businessId) }}</router-link>
            <span v-if="saidBy(item).more > 0" class="scope-said-more">
              {{ $t("components.callInsights.scope.andMore", { count: saidBy(item).more }) }}
            </span>
          </div>
        </li>
      </ul>
      <div v-if="integrations.items.length > 0" class="scope-pager">
        <span class="scope-shown">{{ $t("components.callInsights.scope.shownIntegrations", { shown: integrations.items.length, total: integrations.total }) }}</span>
        <Button
          v-if="integrations.hasMore"
          type="button"
          size="small"
          outlined
          :loading="integrations.loadingMore"
          :label="$t('components.callInsights.scope.loadMoreIntegrations')"
          @click="integrations.more()"
        />
      </div>
    </template>

    <template v-if="showConfigSuggestions && configSuggestions.status !== 'absent'">
      <h4 class="quality-group-title scope-config-title">{{ $t("components.callInsights.scope.configSuggestionsTitle") }}</h4>
      <div v-if="configSuggestions.status === 'loading'" class="insights-note" role="status">
        {{ $t("components.callInsights.scope.loading") }}
      </div>
      <div v-else-if="configSuggestions.status === 'unavailable'" class="insights-note">
        {{ $t("components.callInsights.notAvailableYet") }}
      </div>
      <template v-else-if="configSuggestions.status === 'ok'">
        <div v-if="configSuggestions.items.length === 0" class="insights-note">{{ $t("components.callInsights.scope.none") }}</div>
        <div v-if="configSuggestions.items.length > 0" class="scope-card">
        <div v-for="biz in configSuggestions.items" :key="biz.businessId" class="scope-config-business">
          <div class="scope-config-head">
            <router-link :to="businessLink(biz.businessId)" class="scope-business-link scope-business-strong">
              {{ label(biz.name, biz.businessId) }}
            </router-link>
            <span v-if="!biz.name" class="scope-template">{{ $t("components.callInsights.assistants.noName") }}</span>
            <span v-if="biz.periodEnd" class="scope-template">
              {{ $t("components.callInsights.scope.reportEnding", { date: formatDate(biz.periodEnd) }) }}
            </span>
          </div>
          <ul class="report-suggestion-list">
            <li v-for="(s, i) in biz.suggestions" :key="i">{{ s }}</li>
          </ul>
        </div>
        </div>
        <div v-if="configSuggestions.items.length > 0" class="scope-pager">
          <span class="scope-shown">{{ $t("components.callInsights.scope.shownSuggestions", { shown: configSuggestions.items.length, total: configSuggestions.total }) }}</span>
          <Button
            v-if="configSuggestions.hasMore"
            type="button"
            size="small"
            outlined
            :loading="configSuggestions.loadingMore"
            :label="$t('components.callInsights.scope.loadMoreSuggestions')"
            @click="configSuggestions.more()"
          />
        </div>
      </template>
    </template>
  </div>
</template>

<script>
import CallInsights from "@/utils/CallInsights";

/**
 * "Integrations and information asked" and, for an admin, MrCall's own configuration suggestions
 * (brief outcomes 5 and 10): across the caller's whole scope since a fixed start StarChat itself
 * chooses (30 days, since nothing here sends `timestampGte`), so these two never react to the page's
 * date range, business or owner filters, unlike every other section.
 *
 * Each list is read a page at a time (`CallInsights.pagedList`), the next page only when the user asks
 * for it: a platform's worth of reports is never loaded at once. The lists are this component's own,
 * since no other section reads them; the parent says when the role is known (`ready`) and whether the
 * admin-only list is asked for at all (`showConfigSuggestions`; StarChat answers anyone else 404
 * already). Every business is shown by its name, the id only when StarChat has none, and opens that
 * business's analytics; an integration's business opens it at the report that said it.
 */
export default {
  props: {
    ready: { type: Boolean, default: false },
    showConfigSuggestions: { type: Boolean, default: false },
    // template name -> human name, from the templates the page loads; a template without one is not
    // shown, rather than as its raw key
    templateNames: { type: Object, default: () => ({}) },
  },
  emits: ["error", "names"],
  data() {
    const user = () => this.$store.state.user;
    return {
      integrations: CallInsights.pagedList(
        (from, size, asOf) => CallInsights.integrations(user(), undefined, from, size, asOf),
        { keyOf: (item) => this.integrationKey(item), onError: (error) => this.$emit("error", error, "integrations") },
      ),
      configSuggestions: CallInsights.pagedList(
        (from, size, asOf) => CallInsights.configSuggestions(user(), undefined, from, size, asOf),
        { keyOf: (item) => item.businessId, onError: (error) => this.$emit("error", error, "config-suggestions") },
      ),
      started: false,
    };
  },
  watch: {
    ready: {
      immediate: true,
      handler(value) {
        if (value) this.start();
      },
    },
    "integrations.items"(items) {
      const names = {};
      items.forEach((item) => CallInsights.saidBy(item).said.forEach((who) => { if (who.name) names[who.businessId] = who.name; }));
      this.$emit("names", names);
    },
    "configSuggestions.items"(items) {
      const names = {};
      items.forEach((biz) => { if (biz.name) names[biz.businessId] = biz.name; });
      this.$emit("names", names);
    },
  },
  methods: {
    // Fetched once: the lists do not follow the page's filters (see above).
    start() {
      if (this.started || !this.$store.state.user) return;
      this.started = true;
      this.integrations.first();
      if (this.showConfigSuggestions) this.configSuggestions.first();
    },
    // StarChat groups an item by plan template, kind and text: together they are its identity.
    integrationKey(item) {
      return [item.kind, item.template || "", item.text].join("\u0000");
    },
    saidBy(item) {
      return CallInsights.saidBy(item);
    },
    label(name, businessId) {
      return CallInsights.businessLabel(name, businessId);
    },
    kindLabel(kind) {
      const key = "components.callInsights.scope.kinds." + kind;
      return this.$te(key) ? this.$t(key) : null;
    },
    templateLabel(template) {
      return this.templateNames[template];
    },
    counts(item) {
      const businesses = item.businesses || 0;
      const reports = item.reports || 0;
      return this.$t("components.callInsights.scope.saidBy", {
        businesses: this.$t("components.callInsights.scope.businessesCount", businesses),
        reports: this.$t("components.callInsights.scope.reportsCount", reports),
      });
    },
    businessLink(businessId, reportPeriodStart) {
      const query = { id: businessId };
      if (reportPeriodStart != null) query.report = String(reportPeriodStart);
      return { path: "/analytics", query };
    },
    formatDate(epochMs) {
      return new Date(epochMs).toLocaleDateString();
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

.scope-label {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: @mrcall_grey_text2;
  font-style: italic;
}

.scope-card {
  padding: 12px 16px;
  background: @mrcall_white;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
}

.scope-list {
  list-style: none;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.scope-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 12px;
  border-bottom: 1px solid @mrcall_borders;

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
}

.scope-item-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
  flex-wrap: wrap;
}

.scope-item-text {
  color: @mrcall_dark_grey_text;
  font-weight: 600;
}

.scope-item-counts {
  color: @mrcall_grey_text;
  white-space: nowrap;
}

.scope-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.scope-kind {
  font-size: 11px;
}

.scope-template {
  font-size: 12px;
  color: @mrcall_grey_text;
}

.scope-said {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  font-size: 13px;
}

.scope-said-label,
.scope-said-more {
  color: @mrcall_grey_text;
}

.scope-business-link {
  color: @mrcall_blue;
  text-decoration: none;

  &:hover,
  &:focus-visible {
    text-decoration: underline;
  }
}

.scope-business-strong {
  font-weight: 700;
}

.scope-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  font-size: 13px;
  color: @mrcall_grey_text;
}

.scope-config-title {
  margin-top: 20px;
}

.scope-config-business {
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.scope-config-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.quality-group-title {
  margin: 0 0 6px 0;
  font-size: 13px;
  font-weight: 700;
  color: @mrcall_grey_text2;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.report-suggestion-list {
  margin: 4px 0 0 0;
  padding-left: 18px;
  font-size: 14px;
  color: @mrcall_dark_grey_text;
}
</style>
