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
        icon="pi pi-check"
        autofocus
        @click="visibleModel = false"
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
    validator: (v) => v === "micDenied" || v === "micNotFound" || v === null,
  },
});

const emit = defineEmits(["update:visible"]);

const { t } = useI18n();

const visibleModel = computed({
  get: () => props.visible,
  set: (v) => emit("update:visible", v),
});

const body = computed(() => {
  const key = props.kind === "micNotFound" ? "micNotFound" : "micDenied";
  return t(`components.directVoice.${key}`);
});
</script>

<style scoped lang="less">
.mic-permission-dialog-body {
  margin: 0;
  line-height: 1.5;
}
</style>
