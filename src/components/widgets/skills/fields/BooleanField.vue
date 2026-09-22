<script setup>
import ToggleSwitch from 'primevue/toggleswitch'

/** On or off, stored as the string the variables hold: `"true"` and `"false"`, never a JSON boolean,
  * because that is what every reader of these configurations expects. */
defineProps({
  field: { type: Object, required: true },
  modelValue: { type: [String, Boolean], default: 'false' },
  disabled: { type: Boolean, default: false }
})
defineEmits(['update:modelValue'])
</script>

<template>
  <ToggleSwitch :modelValue="modelValue === 'true' || modelValue === true"
                @update:modelValue="$emit('update:modelValue', $event ? 'true' : 'false')"
                :disabled="disabled" />
</template>
