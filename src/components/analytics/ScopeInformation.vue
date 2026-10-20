<template>
  <div v-if="integrationsStatus !== 'absent'" class="analytics-section call-insights-section">
    <h3 class="section-title">{{ $t("components.callInsights.scope.title") }}</h3>
    <p class="scope-label">{{ $t("components.callInsights.scope.allBusinesses") }}</p>

    <div v-if="integrationsStatus === 'unavailable'" class="insights-note">
      {{ $t("components.callInsights.notAvailableYet") }}
    </div>
    <template v-else-if="integrationsStatus === 'ok'">
      <div v-if="integrations.length === 0" class="insights-note">{{ $t("components.callInsights.scope.none") }}</div>
      <ul v-else class="scope-list">
        <li v-for="(item, idx) in integrations" :key="idx">
          <span class="scope-item-text">{{ item.text }}</span>
          <span class="scope-item-counts">
            {{ $t("components.callInsights.scope.saidBy", { businesses: item.businesses, reports: item.reports }) }}
          </span>
        </li>
      </ul>
    </template>

    <template v-if="showConfigSuggestions">
      <h4 class="quality-group-title scope-config-title">{{ $t("components.callInsights.scope.configSuggestionsTitle") }}</h4>
      <div v-if="configSuggestionsStatus === 'unavailable'" class="insights-note">
        {{ $t("components.callInsights.notAvailableYet") }}
      </div>
      <template v-else-if="configSuggestionsStatus === 'ok'">
        <div v-if="configSuggestions.length === 0" class="insights-note">{{ $t("components.callInsights.scope.none") }}</div>
        <div v-for="biz in configSuggestions" :key="biz.businessId" class="scope-config-business">
          <strong>{{ biz.businessId }}</strong>
          <ul class="report-suggestion-list">
            <li v-for="(s, i) in biz.suggestions" :key="i">{{ s }}</li>
          </ul>
        </div>
      </template>
    </template>
  </div>
</template>

<script>
/**
 * "Integrations and information asked" and, for an admin, MrCall's own configuration suggestions
 * (brief outcome 5): across the caller's whole scope since a fixed start StarChat itself chooses
 * (30 days, since the parent never sends `timestampGte`), so these two never react to the page's
 * date range, business or owner filters, unlike every other section. `mrcall_config` is admin-only
 * on the server already; `showConfigSuggestions` additionally gates it here so a non-admin role
 * never asks for it at all.
 */
export default {
  props: {
    integrationsStatus: { type: String, required: true },
    integrations: { type: Array, default: () => [] },
    showConfigSuggestions: { type: Boolean, default: false },
    configSuggestionsStatus: { type: String, default: "ok" },
    configSuggestions: { type: Array, default: () => [] },
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

.scope-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;

  li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 14px;
  }
}

.scope-item-text {
  color: @mrcall_dark_grey_text;
}

.scope-item-counts {
  color: @mrcall_grey_text;
  white-space: nowrap;
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
