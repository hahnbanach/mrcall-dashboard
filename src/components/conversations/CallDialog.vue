<template>
  <Dialog :visible="visible" modal :header="header" class="call-dialog"
          :dismissableMask="true" @update:visible="v => $emit('update:visible', v)" @show="open(ids[0])">
    <div v-if="ids.length > 1" class="call-dialog-list" role="group" :aria-label="$t('components.callInsights.callDialog.list')">
      <button v-for="(id, i) in ids" :key="id" type="button" :aria-pressed="id === current" @click="open(id)">
        {{ i === 0 ? $t("components.callInsights.callDialog.latest") : i === ids.length - 1 ? $t("components.callInsights.callDialog.first") : $t("components.callInsights.callDialog.nth", { n: ids.length - i }) }}
      </button>
    </div>
    <p v-if="state === 'loading'" class="call-dialog-muted">{{ $t("components.callInsights.callDialog.loading") }}</p>
    <p v-else-if="state === 'missing'" class="call-dialog-muted">{{ $t("components.callInsights.callDialog.missing") }}</p>
    <p v-else-if="state === 'error'" class="call-dialog-error">{{ $t("components.callInsights.callDialog.error") }}</p>
    <template v-else-if="conversation">
      <p class="call-dialog-muted call-dialog-when">{{ when }}</p>
      <p v-if="readOnly" class="call-dialog-muted">{{ $t("components.callInsights.feedback.readOnly.title") }}</p>
      <!-- opened on purpose, as the conversations page's opened call: its judgements as chips, read at once for the
           owner; read-only for anyone else (brief docs/briefs/2026-10-27-classification-feedback.md, amendment item 7) -->
      <CallDetailsPanel
        :key="conversation.id"
        :conversation="conversation"
        :business-id="businessId"
        :user="user"
        :expanded="true"
        :eager="true"
        :read-only="readOnly"
        :with-judgements="true"
      />
    </template>
    <UndoBar />
  </Dialog>
</template>

<script>
import { isSessionEnded } from "@/firebase/session";
import ConversationApi from "@/utils/Conversation";
import CallDetailsPanel from "@/components/conversations/CallDetailsPanel.vue";
import UndoBar from "@/components/feedback/UndoBar.vue";
import CallInsights from "@/utils/CallInsights";
import Classifications from "@/utils/Classifications";

/**
 * One call, or the calls of one thing (a booking changed by later calls: newest first), read through Conversation.get
 * and drawn by the panel the conversations page uses, over the page that opened it: closing returns to that page as it
 * was (brief docs/briefs/2026-10-31-analytics-ux.md, O1). Used by the restaurant page and, through
 * `AnalyticsOverlayHost`, by every analytics page.
 *
 * One dialog serves calls of several businesses on the analytics pages, so the owner is read per business (cached
 * for the dialog's life) and the dialog is read-only unless the reader is known to own the business of the call shown
 * (`Classifications.isOwnerOf`): a non-owner's read of a call's judgements and recording is recorded by StarChat and
 * made only on the person's request.
 */
export default {
  components: { CallDetailsPanel, UndoBar },
  props: {
    visible: { type: Boolean, default: false },
    ids: { type: Array, default: () => [] },
    title: { type: String, default: "" },
    user: { type: Object, required: true },
    businessId: { type: String, default: null },
  },
  emits: ["update:visible"],
  data() {
    return { current: null, conversation: null, state: "idle", owners: {} };
  },
  computed: {
    header() {
      return this.title ? this.$t("components.callInsights.callDialog.titleOf", { name: this.title }) : this.$t("components.callInsights.callDialog.title");
    },
    readOnly() {
      return Classifications.isOwnerOf(this.owners[this.businessId], this.user) !== true;
    },
    when() {
      const ts = this.conversation && this.conversation.startTimestamp;
      return ts ? new Date(ts).toLocaleString(this.$i18n.locale, { dateStyle: "full", timeStyle: "short" }) : "";
    },
  },
  methods: {
    async open(id) {
      if (!id || !this.businessId) return;
      const businessId = this.businessId;
      this.current = id;
      this.conversation = null;
      this.state = "loading";
      try {
        if (!(businessId in this.owners)) {
          const business = await CallInsights.business(this.user, businessId).catch(() => null);
          this.owners = { ...this.owners, [businessId]: business };
        }
        const found = await ConversationApi.get(this.user, businessId, id);
        if (this.current !== id || this.businessId !== businessId) return;
        this.conversation = found;
        this.state = found ? "shown" : "missing";
      } catch (e) {
        if (isSessionEnded(e)) return;
        console.error("Call not read:", e && e.response ? e.response.status : e);
        if (this.current === id) this.state = "error";
      }
    },
  },
};
</script>

<style lang="less">
@import "../../assets/style/colors";

// not scoped: PrimeVue teleports the dialog to the body, outside this component's root
.call-dialog {
  width: min(720px, 96vw);

  .call-dialog-list {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;

    button {
      border: 1px solid @mrcall_borders;
      background: @mrcall_white;
      border-radius: @mrcall_radius_pill;
      padding: 4px 12px;
      min-height: 34px;
      font: inherit;
      cursor: pointer;

      &[aria-pressed="true"] {
        border-color: @mrcall_blue;
        background: @mrcall_bluette;
        color: @mrcall_blue;
        font-weight: 700;
      }
    }
  }

  .call-dialog-muted {
    color: @mrcall_grey_text;
    font-size: 14px;
  }

  .call-dialog-error {
    color: @mrcall_status_error;
    font-size: 14px;
  }
}
</style>
