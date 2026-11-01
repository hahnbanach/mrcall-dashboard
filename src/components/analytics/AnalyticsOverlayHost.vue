<template>
  <div class="analytics-overlay-host">
    <slot />
    <!-- The one undo of a gesture on callers' requests (brief docs/briefs/2026-10-27-classification-feedback.md, scope 2).
         While the call dialog is open its own bar is the one in reach (this one would sit under the modal's mask), so a
         single live region speaks at a time; hidden, not removed, so its live region exists before it speaks. -->
    <UndoBar v-show="!call.visible" />
    <CountedCallsPanel
      v-model:visible="panel.visible"
      :link="panel.link"
      :label="panel.label"
      :count="panel.count"
      :user="user"
      @open-call="openCall"
    />
    <CallDialog
      v-model:visible="call.visible"
      :ids="call.ids"
      :business-id="call.businessId"
      :user="user"
    />
  </div>
</template>

<script>
import CallDialog from "@/components/conversations/CallDialog.vue";
import CountedCallsPanel from "@/components/analytics/CountedCallsPanel.vue";
import UndoBar from "@/components/feedback/UndoBar.vue";

/**
 * The seam through which any section of an analytics page opens a call or a count's calls over the page instead of
 * leaving it (brief docs/briefs/2026-10-31-analytics-ux.md, O1 and O2): one call dialog and one counted-calls panel
 * per page, provided to the sections as `analyticsOverlay` (`openCall(businessId, id)`,
 * `openCount(link, label, count)`). A section with no host above it (`inject` default null) keeps its link.
 * Opening either alters neither the address nor the history.
 */
export default {
  components: { CallDialog, CountedCallsPanel, UndoBar },
  provide() {
    return {
      analyticsOverlay: {
        openCall: (businessId, id) => this.openCall(businessId, id),
        openCount: (link, label, count) => this.openCount(link, label, count),
      },
    };
  },
  data() {
    return {
      call: { visible: false, ids: [], businessId: null },
      panel: { visible: false, link: null, label: "", count: 0 },
    };
  },
  computed: {
    user() {
      return this.$store.state.user;
    },
  },
  methods: {
    openCall(businessId, id) {
      if (!businessId || !id) return;
      this.call = { visible: true, ids: [id], businessId };
    },
    openCount(link, label, count) {
      if (!link) return;
      this.panel = { visible: true, link, label, count };
    },
  },
};
</script>
