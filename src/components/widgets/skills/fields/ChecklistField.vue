<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Checkbox from 'primevue/checkbox'
import { optionTextOf } from '@/components/widgets/skills/manifestFields'

/** A tick box per choice (`x-widget: checklist`): the restaurant's operations, which an owner was asked to type as a
  * JSON list (2026-10-18). The stored value stays what it was, the JSON text of the values ticked
  * (`x-encoding: json-string`), so a dashboard without this widget draws the same value in its JSON box.
  *
  * Only a value the manifest titles is offered. One stored but untitled (the restaurant's `update`, which the
  * phone-changes setting governs) is kept as it is and never shown, so a save does not drop it. */
const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { type: [String, Array], default: '' },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const { locale } = useI18n()
const lang = computed(() => (locale.value || 'en-US').split('-')[0])

function parsed (value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' || value.trim() === '') return null
  try {
    const list = JSON.parse(value)
    return Array.isArray(list) ? list : null
  } catch {
    return null
  }
}

const offered = computed(() => (props.field.options || [])
  .filter(o => o.labels || o.label)
  .map(o => ({ value: o.value, ...optionTextOf(o, lang.value) })))
const ticked = computed(() => parsed(props.modelValue) || parsed(props.field.default) || [])

function toggle (value, on) {
  const kept = ticked.value.filter(v => !offered.value.some(o => o.value === v))
  const chosen = offered.value.map(o => o.value).filter(v => (v === value ? on : ticked.value.includes(v)))
  emit('update:modelValue', JSON.stringify([...chosen, ...kept]))
}
</script>

<template>
  <div class="checklist-field">
    <div v-for="option in offered" :key="option.value" class="checklist-option">
      <Checkbox :inputId="`${field.key}-${option.value}`"
                :modelValue="ticked.includes(option.value)"
                @update:modelValue="toggle(option.value, $event)"
                :binary="true"
                :disabled="disabled" />
      <label :for="`${field.key}-${option.value}`" class="checklist-text">
        <span>{{ option.label }}</span>
        <small v-if="option.hint" class="checklist-hint">{{ option.hint }}</small>
      </label>
    </div>
  </div>
</template>

<style scoped lang="less">
.checklist-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.checklist-option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.checklist-text {
  display: flex;
  flex-direction: column;
  font-size: 0.8rem;
  cursor: pointer;
}

.checklist-hint {
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
  line-height: 1.3;
}
</style>
