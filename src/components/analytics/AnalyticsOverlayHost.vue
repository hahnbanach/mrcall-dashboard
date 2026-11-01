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
      @after-hide="giveFocusBack('panel')"
    />
    <CallDialog
      v-model:visible="call.visible"
      :ids="call.ids"
      :business-id="call.businessId"
      :user="user"
      @after-hide="giveFocusBack('call')"
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
        openCall: (businessId, id, trigger) => this.openCall(businessId, id, trigger),
        openCount: (link, label, count, trigger) => this.openCount(link, label, count, trigger),
      },
    };
  },
  created() {
    // the controls that opened the dialog and the panel: DOM elements, kept out of Vue's reactivity
    this.triggers = { call: null, panel: null };
  },
  data() {
    return {
      call: { visible: false, ids: [], businessId: null },
      panel: { visible: false, link: null, label: "", count: null },
    };
  },
  computed: {
    user() {
      return this.$store.state.user;
    },
  },
  methods: {
    openCall(businessId, id, trigger) {
      if (!businessId || !id) return;
      this.triggers.call = trigger || null;
      this.call = { visible: true, ids: [id], businessId };
    },
    openCount(link, label, count, trigger) {
      if (!link) return;
      this.triggers.panel = trigger || null;
      this.panel = { visible: true, link, label, count: typeof count === "number" ? count : null };
    },
    // Closing returns the keyboard to the control that opened the dialog or the panel. The control is remembered
    // rather than read from the focus: WebKit does not focus a button on click, and PrimeVue's Drawer gives no focus
    // back, so after a close the focus was on the page's body (measured on both).
    giveFocusBack(which) {
      const trigger = this.triggers[which];
      this.triggers[which] = null;
      if (trigger && trigger.isConnected && typeof trigger.focus === "function") trigger.focus();
    },
  },
};
</script>
