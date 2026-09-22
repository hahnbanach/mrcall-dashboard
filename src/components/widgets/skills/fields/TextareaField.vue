<script setup>
import Textarea from 'primevue/textarea'

/** Several lines: a prompt, a template, anything a person writes rather than picks. */
defineProps({
  field: { type: Object, required: true },
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' }
})
defineEmits(['update:modelValue'])
</script>

<template>
  <Textarea :modelValue="modelValue"
            @update:modelValue="$emit('update:modelValue', $event)"
            :disabled="disabled"
            :placeholder="placeholder"
            class="w-full"
            rows="4"
            autoResize />
</template>
