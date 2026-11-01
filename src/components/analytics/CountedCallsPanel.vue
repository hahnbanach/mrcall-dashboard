<template>
  <Drawer :visible="visible" position="right" class="counted-calls-panel" :header="label"
          @update:visible="v => $emit('update:visible', v)" @after-hide="$emit('after-hide')">
    <!-- a count not known (a report's group whose analytics were not read): no number is printed, the list says its own -->
    <p v-if="count !== null" class="counted-calls-count">{{ $t("components.callInsights.countedCalls.count", { n: count }, count) }}</p>
    <CountedCallsList :link="link" :label="label" :user="user" @open-call="(...a) => $emit('open-call', ...a)" />
  </Drawer>
</template>

<script>
import CountedCallsList from "@/components/analytics/CountedCallsList.vue";

/**
 * The calls a count counts, over the page that shows the count (brief docs/briefs/2026-10-31-analytics-ux.md, O2): it
 * states the count it was opened from and draws `CountedCallsList` (the search, the rows, "Open in Conversations").
 * Opening the panel reads the search only; a call is read when the person opens it.
 */
export default {
  components: { CountedCallsList },
  props: {
    visible: { type: Boolean, default: false },
    // the count's link: `{path: "/conversations", query}`
    link: { type: Object, default: null },
    label: { type: String, default: "" },
    // null when the count is not known: the panel then states none (the pager still says how many it found)
    count: { type: Number, default: null },
    user: { type: Object, required: true },
  },
  emits: ["update:visible", "open-call", "after-hide"],
};
</script>

<style lang="less">
@import "../../assets/style/colors";

// not scoped: PrimeVue teleports the drawer to the body, outside this component's root. Its own `.p-drawer-right .p-drawer`
// (width 20rem) is injected at runtime, after the production stylesheet, so an equally specific rule here loses there
// (measured on test, 2026-11-01, while it won on the dev server): the mask class makes this one more specific.
.p-drawer-right .counted-calls-panel.p-drawer {
  width: min(720px, 100vw);

  .counted-calls-count {
    margin: 0 0 8px 0;
    font-weight: 600;
    color: @mrcall_dark_grey_text;
  }
}
</style>
