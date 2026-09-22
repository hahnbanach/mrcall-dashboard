<script setup>
import InputText from 'primevue/inputtext'

/** A secret typed in, shown as dots. What is stored is a secret by declaration — `x-secret` in the
  * manifest — and this is only the part a person sees. */
defineProps({
  field: { type: Object, required: true },
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' }
})
defineEmits(['update:modelValue'])
</script>

<template>
  <InputText :modelValue="modelValue"
             @update:modelValue="$emit('update:modelValue', $event)"
             :disabled="disabled"
             type="password"
             :placeholder="placeholder"
             class="w-full"
             size="small" />
</template>
