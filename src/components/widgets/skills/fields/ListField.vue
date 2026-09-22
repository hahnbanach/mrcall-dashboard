<script setup>
import { ref, watch } from 'vue'
import TupleVariable from '@/components/widgets/TupleVariable.vue'

/** A list of rows, drawn by the same widget the business variables use for the same shape.
  *
  * The value is stored as a JSON string and the widget works on an array, so the two conversions are
  * here rather than in whoever renders the card: what is stored and what is edited differ in
  * spelling only.
  */
const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { type: [String, Array], default: '[]' },
  disabled: { type: Boolean, default: false },
  locale: { type: String, default: 'en' }
})
const emit = defineEmits(['update:modelValue'])

function parse (value) {
  if (Array.isArray(value)) return value
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : (value || [])
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const rows = ref(parse(props.modelValue))

watch(() => props.modelValue, value => {
  if (JSON.stringify(rows.value) !== value) rows.value = parse(value)
})

function publish (value) {
  rows.value = value
  emit('update:modelValue', JSON.stringify(value))
}

/** What the rows may be chosen from, in the language being spoken. */
function selection () {
  if (!props.field.valuesSelection) return []
  return props.field.valuesSelection[props.locale] || props.field.valuesSelection.en || []
}
</script>

<template>
  <TupleVariable :recipient="rows" @update:recipient="publish" :vselection="selection()" />
</template>
