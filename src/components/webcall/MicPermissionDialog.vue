<template>
  <Dialog
    v-model:visible="visibleModel"
    :header="$t('components.directVoice.micDialogTitle')"
    :modal="true"
    :closable="false"
    :closeOnEscape="false"
    position="top"
    :style="{ width: '30rem' }"
    :breakpoints="{ '640px': '90vw' }"
  >
    <p class="mic-permission-dialog-body">{{ body }}</p>
    <template #footer>
      <Button
        :label="$t('components.directVoice.micDialogOk')"
        class="p-button-text"
        @click="visibleModel = false"
      />
      <Button
        :label="$t('components.directVoice.micDialogRetry')"
        icon="pi pi-refresh"
        autofocus
        @click="onRetry"
      />
    </template>
  </Dialog>
</template>

<script setup>
// A mic failure (denied/dismissed prompt, or no device) is the one voice-call
// start error the user can actually fix, so it gets a real modal popup with the
// re-grant instructions — not a 10-second toast that vanishes before the user
// reads it. Other start failures stay as raw-detail toasts for support. The body
// copy is the existing localized `micDenied` / `micNotFound`; only the title and
// the OK button are new strings.
import { computed } from "vue";
import Button from "primevue/button";
import { useI18n } from "vue-i18n";

const props = defineProps({
  visible: { type: Boolean, default: false },
  kind: {
    type: String,
    default: "micDenied",
    validator: (v) => ["micDenied", "micDeniedDismissed", "micNotFound"].includes(v),
  },
});

const emit = defineEmits(["update:visible", "retry"]);

const { t } = useI18n();

const visibleModel = computed({
  get: () => props.visible,
  set: (v) => emit("update:visible", v),
});

/* Chrome discards the permission bubble when the user clicks anywhere in the
 * page, so by the time this dialog shows the original request is already dead:
 * closing the dialog alone leaves the user with no prompt at all. Retry is the
 * primary action because it is the only way to get a fresh bubble. */
const onRetry = () => {
  visibleModel.value = false;
  emit("retry");
};

const body = computed(() => {
  const key = ["micDenied", "micDeniedDismissed", "micNotFound"].includes(props.kind)
    ? props.kind
    : "micDenied";
  return t(`components.directVoice.${key}`);
});
</script>

<style scoped lang="less">
.mic-permission-dialog-body {
  margin: 0;
  line-height: 1.5;
}
</style>
