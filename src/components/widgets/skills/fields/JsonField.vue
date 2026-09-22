<script setup>
import JsonEditorVue from 'json-editor-vue'

/** A document written by hand. Text mode rather than the tree: what is stored is a string, and a
  * tree editor would reformat it on every open, which shows as a change nobody made. */
defineProps({
  field: { type: Object, required: true },
  modelValue: { type: [String, Object, Array], default: '' },
  disabled: { type: Boolean, default: false }
})
defineEmits(['update:modelValue'])
</script>

<template>
  <JsonEditorVue :modelValue="modelValue"
                 @update:modelValue="$emit('update:modelValue', $event)"
                 mode="text"
                 class="w-full json-editor-field" />
</template>
