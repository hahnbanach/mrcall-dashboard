<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  hasMessages: { type: Boolean, default: false }
})

const emit = defineEmits(['submit'])

const message = ref('')

const canSubmit = computed(() =>
  message.value.trim().length > 0 && !props.loading && !props.disabled
)

const suggestions = computed(() => [
  t('views.aladminConfigurator.suggestion1'),
  t('views.aladminConfigurator.suggestion2'),
  t('views.aladminConfigurator.suggestion3'),
  t('views.aladminConfigurator.suggestion4')
])

function submit() {
  if (!canSubmit.value) return
  emit('submit', message.value.trim())
  message.value = ''
}

function applySuggestion(text) {
  message.value = text
}

function onKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submit()
  }
}
</script>

<template>
  <div class="ai-configure-form">
    <div v-if="!hasMessages" class="suggestions">
      <span class="suggestions-label">{{ t('views.aladminConfigurator.suggestionsLabel') }}</span>
      <div class="suggestions-chips">
        <Button
          v-for="(suggestion, index) in suggestions"
          :key="index"
          :label="suggestion"
          outlined
          size="small"
          class="suggestion-chip"
          :disabled="loading"
          @click="applySuggestion(suggestion)"
        />
      </div>
    </div>

    <div class="input-row">
      <Textarea
        v-model="message"
        :placeholder="t('views.aladminConfigurator.messagePlaceholder')"
        :disabled="loading || disabled"
        rows="1"
        class="message-input"
        autoResize
        @keydown="onKeydown"
      />
      <Button
        icon="pi pi-send"
        class="send-button"
        :loading="loading"
        :disabled="!canSubmit"
        @click="submit"
      />
    </div>
  </div>
</template>

<style scoped lang="less">
@import '../../assets/style/colors';

.ai-configure-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.suggestions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.suggestions-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: @mrcall_grey_text;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.suggestions-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.suggestion-chip {
  font-size: 0.8rem !important;
  white-space: normal;
  text-align: left;
}

.input-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.message-input {
  flex: 1;
  min-height: 2.5rem !important;
  max-height: 8rem;
}

.send-button {
  flex-shrink: 0;
  height: 2.5rem;
  width: 2.5rem;
}

@media screen and (max-width: 480px) {
  .input-row {
    gap: 0.35rem;
  }
}
</style>
