<template>
  <button v-if="analyticsOverlay" type="button" class="call-link" @click="analyticsOverlay.openCall(businessId, conversationId)"><slot>{{ $t("components.callInsights.feedback.categories.call") }}</slot></button>
  <router-link v-else :to="{ path: '/conversations', query: { id: businessId, conversation: conversationId } }" class="call-link"><slot>{{ $t("components.callInsights.feedback.categories.call") }}</slot></router-link>
</template>

<script>
/**
 * "Apri la chiamata": one call of a business. On an analytics page (under `AnalyticsOverlayHost`) it opens the call
 * dialog over the page (brief docs/briefs/2026-10-31-analytics-ux.md, O1), so the page keeps its scroll and its open
 * sections; elsewhere it links to the conversations page's opened call. The accessible name is the caller's
 * `aria-label`, passed through.
 */
export default {
  inject: { analyticsOverlay: { default: null } },
  props: {
    businessId: { type: String, required: true },
    conversationId: { type: String, required: true },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

// a button drawn as the link it replaces
button.call-link {
  color: @mrcall_blue;
  text-decoration: underline;
  text-underline-offset: 2px;
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  cursor: pointer;
}
</style>
