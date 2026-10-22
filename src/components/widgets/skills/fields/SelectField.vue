<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Dropdown from 'primevue/dropdown'
import { optionTextOf } from '@/components/widgets/skills/manifestFields'

/** One of a declared list. The options and their labels come from the manifest — `enum` and
  * `x-enum-titles` — so what is offered here and what the server accepts are the same list.
  *
  * Each option is titled in the screen's language and explained (`options[].labels`, from `x-enum-titles` and
  * `x-enum-hints`): the list shows every option's explanation, and the one chosen keeps its own under the control.
  * An Italian card used to title its options in English with nothing to say what each one does (2026-10-18). */
const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' }
})
defineEmits(['update:modelValue'])

const { locale } = useI18n()
const lang = computed(() => (locale.value || 'en-US').split('-')[0])

const options = computed(() => (props.field.options || []).map(o => ({ value: o.value, ...optionTextOf(o, lang.value) })))
const selected = computed(() => props.modelValue || props.field.default || '')
const chosenHint = computed(() => (options.value.find(o => o.value === selected.value) || {}).hint || '')
</script>

<template>
  <div class="select-field">
    <Dropdown :modelValue="selected"
              @update:modelValue="$emit('update:modelValue', $event)"
              :options="options"
              optionLabel="label"
              optionValue="value"
              :disabled="disabled"
              :placeholder="placeholder"
              class="w-full"
              size="small">
      <template #option="slotProps">
        <div class="select-option">
          <div>{{ slotProps.option.label }}</div>
          <small v-if="slotProps.option.hint" class="select-option-hint">{{ slotProps.option.hint }}</small>
        </div>
      </template>
    </Dropdown>
    <small v-if="chosenHint" class="select-chosen-hint">{{ chosenHint }}</small>
  </div>
</template>

<style scoped lang="less">
.select-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.select-option {
  display: flex;
  flex-direction: column;
  max-width: 32rem;
  white-space: normal;
}

.select-option-hint,
.select-chosen-hint {
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
  line-height: 1.3;
}
</style>
