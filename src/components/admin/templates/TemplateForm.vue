<template>
  <div class="template-form">
    <div class="form-field">
      <label>{{ $t('components.admin.templates.provider') }}</label>
      <Dropdown
        :modelValue="config.llmConfig?.provider || 'openai'"
        @update:modelValue="updateLlm('provider', $event)"
        :options="providerOptions"
        optionLabel="label"
        optionValue="value"
        :disabled="readOnly"
      />
    </div>

    <div class="form-field">
      <label>{{ $t('components.admin.templates.model') }}</label>
      <InputText
        :modelValue="config.llmConfig?.model || ''"
        @update:modelValue="updateLlm('model', $event)"
        :disabled="readOnly"
      />
    </div>

    <div class="form-row">
      <div class="form-field">
        <label>{{ $t('components.admin.templates.temperature') }}</label>
        <InputNumber
          :modelValue="config.llmConfig?.temperature ?? 0.7"
          @update:modelValue="updateLlm('temperature', $event)"
          :min="0" :max="2" :step="0.1"
          :minFractionDigits="1" :maxFractionDigits="1"
          :disabled="readOnly"
        />
      </div>
      <div class="form-field">
        <label>{{ $t('components.admin.templates.maxTokens') }}</label>
        <InputNumber
          :modelValue="config.llmConfig?.maxTokens ?? 4096"
          @update:modelValue="updateLlm('maxTokens', $event)"
          :min="1" :max="128000"
          :disabled="readOnly"
        />
      </div>
    </div>

    <div class="form-field">
      <label>{{ $t('components.admin.templates.systemPrompt') }}</label>
      <Textarea
        :modelValue="config.systemPrompt || ''"
        @update:modelValue="updateField('systemPrompt', $event)"
        rows="12"
        autoResize
        class="system-prompt-textarea"
        :disabled="readOnly"
      />
    </div>

    <div class="form-field" v-if="availableTools.length > 0">
      <label>{{ $t('components.admin.templates.tools') }}</label>
      <MultiSelect
        :modelValue="config.tools || []"
        @update:modelValue="updateField('tools', $event)"
        :options="availableTools"
        display="chip"
        :disabled="readOnly"
      />
    </div>

    <div class="form-row">
      <div class="form-field">
        <label>{{ $t('components.admin.templates.enableMemory') }}</label>
        <ToggleSwitch
          :modelValue="config.enableMemory || false"
          @update:modelValue="updateField('enableMemory', $event)"
          :disabled="readOnly"
        />
      </div>
      <div class="form-field">
        <label>{{ $t('components.admin.templates.maxHistory') }}</label>
        <InputNumber
          :modelValue="config.maxHistoryMessages ?? 200"
          @update:modelValue="updateField('maxHistoryMessages', $event)"
          :min="0" :max="10000"
          :disabled="readOnly"
        />
      </div>
    </div>

    <div class="form-row">
      <div class="form-field">
        <label>{{ $t('components.admin.templates.maxToolIterations') }}</label>
        <InputNumber
          :modelValue="config.maxToolIterations ?? 10"
          @update:modelValue="updateField('maxToolIterations', $event)"
          :min="1" :max="100"
          :disabled="readOnly"
        />
      </div>
      <div class="form-field">
        <label>{{ $t('components.admin.templates.timeout') }}</label>
        <InputNumber
          :modelValue="config.requestTimeoutSeconds ?? 60"
          @update:modelValue="updateField('requestTimeoutSeconds', $event)"
          :min="1" :max="600"
          :disabled="readOnly"
        />
      </div>
    </div>

    <div class="form-row">
      <div class="form-field">
        <label>{{ $t('components.admin.templates.enableToolCallValidation') }}</label>
        <ToggleSwitch
          :modelValue="config.enableToolCallValidation || false"
          @update:modelValue="updateField('enableToolCallValidation', $event)"
          :disabled="readOnly"
        />
      </div>
      <div class="form-field">
        <label>{{ $t('components.admin.templates.enableInputSanitization') }}</label>
        <ToggleSwitch
          :modelValue="config.enableInputSanitization || false"
          @update:modelValue="updateField('enableInputSanitization', $event)"
          :disabled="readOnly"
        />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    modelValue: { type: Object, required: true },
    availableTools: { type: Array, default: () => [] },
    readOnly: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  computed: {
    config() {
      return this.modelValue || {}
    },
    providerOptions() {
      return [
        { label: 'OpenAI', value: 'openai' },
        { label: 'Anthropic', value: 'anthropic' },
        { label: 'Google', value: 'google' },
        { label: 'Ollama', value: 'ollama' }
      ]
    }
  },
  methods: {
    updateField(field, value) {
      this.$emit('update:modelValue', { ...this.config, [field]: value })
    },
    updateLlm(field, value) {
      const llmConfig = { ...(this.config.llmConfig || {}), [field]: value }
      this.$emit('update:modelValue', { ...this.config, llmConfig })
    }
  }
}
</script>

<style lang="less" scoped>
@import '../../../assets/style/colors';

.template-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;

  label {
    font-size: 0.85rem;
    font-weight: 600;
    color: @mrcall_dark_grey_text;
  }
}

.form-row {
  display: flex;
  gap: 1rem;
}

.system-prompt-textarea {
  font-family: monospace;
  font-size: 0.85rem;
  line-height: 1.5;
}

@media screen and (max-width: 640px) {
  .form-row {
    flex-direction: column;
  }
}
</style>
