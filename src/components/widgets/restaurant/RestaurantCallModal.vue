<template>
  <Dialog :visible="visible" modal :header="header" class="rb-modal restaurant-call-dialog"
          :dismissableMask="true" @update:visible="v => $emit('update:visible', v)" @show="open(ids[0])">
    <div v-if="ids.length > 1" class="call-list" role="group" :aria-label="$t('components.restaurant.calls.list')">
      <button v-for="(id, i) in ids" :key="id" :aria-pressed="id === current" @click="open(id)">
        {{ i === 0 ? $t("components.restaurant.calls.latest") : i === ids.length - 1 ? $t("components.restaurant.calls.first") : $t("components.restaurant.calls.nth", { n: ids.length - i }) }}
      </button>
    </div>
    <p v-if="state === 'loading'" class="muted">{{ $t("components.restaurant.calls.loading") }}</p>
    <p v-else-if="state === 'missing'" class="muted">{{ $t("components.restaurant.calls.missing") }}</p>
    <p v-else-if="state === 'error'" class="err">{{ $t("components.restaurant.calls.error") }}</p>
    <template v-else-if="conversation">
      <p class="muted call-when">{{ when }}</p>
      <CallDetailsPanel :key="conversation.id" :conversation="conversation" :business-id="businessId" :user="user" :expanded="true" />
    </template>
  </Dialog>
</template>

<script>
import ConversationApi from "@/utils/Conversation";
import CallDetailsPanel from "@/components/conversations/CallDetailsPanel.vue";

/**
 * "Leggi la chiamata": the call a booking carries, read through Conversation.get and drawn by the same
 * panel the conversations page uses (the details in the order of the call's notification, the transcript,
 * the recording played on request). When later calls changed or cancelled the booking, every call is
 * listed, newest first. Closing returns to the page as it was.
 */
export default {
  components: { CallDetailsPanel },
  props: {
    visible: { type: Boolean, default: false },
    ids: { type: Array, default: () => [] },
    title: { type: String, default: "" },
    user: { type: Object, required: true },
    businessId: { type: String, required: true },
  },
  emits: ["update:visible"],
  data() {
    return { current: null, conversation: null, state: "idle" };
  },
  computed: {
    header() {
      return this.title ? this.$t("components.restaurant.calls.titleOf", { name: this.title }) : this.$t("components.restaurant.calls.title");
    },
    when() {
      const ts = this.conversation && this.conversation.startTimestamp;
      return ts ? new Date(ts).toLocaleString(this.$i18n.locale, { dateStyle: "full", timeStyle: "short" }) : "";
    },
  },
  methods: {
    async open(id) {
      if (!id) return;
      this.current = id;
      this.conversation = null;
      this.state = "loading";
      try {
        const found = await ConversationApi.get(this.user, this.businessId, id);
        if (this.current !== id) return;
        this.conversation = found;
        this.state = found ? "shown" : "missing";
      } catch (e) {
        console.error("Call not read:", e && e.response ? e.response.status : e);
        if (this.current === id) this.state = "error";
      }
    },
  },
};
</script>
