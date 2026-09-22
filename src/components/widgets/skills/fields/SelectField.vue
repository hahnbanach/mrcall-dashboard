<script setup>
import Dropdown from 'primevue/dropdown'

/** One of a declared list. The options and their labels come from the manifest — `enum` and
  * `x-enum-titles` — so what is offered here and what the server accepts are the same list. */
defineProps({
  field: { type: Object, required: true },
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' }
})
defineEmits(['update:modelValue'])
</script>

<template>
  <Dropdown :modelValue="modelValue || field.default || ''"
            @update:modelValue="$emit('update:modelValue', $event)"
            :options="field.options || []"
            optionLabel="label"
            optionValue="value"
            :disabled="disabled"
            :placeholder="placeholder"
            class="w-full"
            size="small" />
</template>
