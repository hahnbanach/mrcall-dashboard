<script setup>
import InputText from 'primevue/inputtext'

/** A line of text, and a url, which differs only in what the browser validates. */
defineProps({
  field: { type: Object, required: true },
  modelValue: { type: [String, Number], default: '' },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' }
})
defineEmits(['update:modelValue'])
</script>

<template>
  <InputText :modelValue="modelValue === null || modelValue === undefined ? '' : String(modelValue)"
             @update:modelValue="$emit('update:modelValue', $event)"
             :disabled="disabled"
             :type="field.widget === 'url' || field.type === 'url' ? 'url' : 'text'"
             :placeholder="placeholder"
             class="w-full"
             size="small" />
</template>
