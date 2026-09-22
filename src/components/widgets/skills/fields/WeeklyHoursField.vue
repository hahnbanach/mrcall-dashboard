<script setup>
import { computed } from 'vue'
import TimeSlotsEditor from '@/components/widgets/TimeSlotsEditor.vue'

/** The weekly grid, with the editor the business's own booking hours already use.
  *
  * Same value, same shape, same way of editing it: a skill that asked for opening times as a JSON
  * document would be asking the same person to do the same job twice, once with help and once
  * without. The value is stored as a JSON string and the editor works on an object, so the two
  * conversions live here.
  */
const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { type: [String, Object], default: '{}' },
  disabled: { type: Boolean, default: false },
  slotDuration: { type: Number, default: 15 }
})
const emit = defineEmits(['update:modelValue'])

const grid = computed(() => {
  const value = props.modelValue
  if (value && typeof value === 'object') return value
  try { return JSON.parse(value || '{}') } catch { return {} }
})

function publish (value) {
  emit('update:modelValue', JSON.stringify(value || {}))
}
</script>

<template>
  <TimeSlotsEditor :modelValue="grid"
                   @update:modelValue="publish"
                   :business="{ variables: {} }"
                   :variable="{ modifiable: !disabled, dependsOn: [] }"
                   :slotDuration="slotDuration" />
</template>
