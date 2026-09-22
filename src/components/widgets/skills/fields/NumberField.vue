<script setup>
import InputNumber from 'primevue/inputnumber'

/** A count of minutes, days or rows.
  *
  * Stored as a string because that is what the business variables hold, and declared `integer` in
  * the manifest so that what is not a number is refused where it is saved rather than rounded here.
  */
defineProps({
  field: { type: Object, required: true },
  modelValue: { type: [String, Number], default: '' },
  disabled: { type: Boolean, default: false }
})
defineEmits(['update:modelValue'])
</script>

<template>
  <InputNumber :modelValue="Number(modelValue) || field.default || 0"
               @update:modelValue="$emit('update:modelValue', String($event))"
               :disabled="disabled"
               :min="field.min"
               :max="field.max"
               class="w-full"
               size="small" />
</template>
