<script setup>
import Dropdown from 'primevue/dropdown'

/** The calendar of an authorisation, chosen BY NAME.
  *
  * What is stored is a Google identifier nobody knows by heart, so the list comes from the
  * authorisation itself and the names come with it. Until there is one, there is nothing to choose
  * from and the card says which authorisation it is waiting for rather than showing an empty box.
  *
  * WHY THIS IS STILL ITS OWN COMPONENT AND NOT A DECLARED SOURCE. The options depend on another
  * field of the same instance — the OAuth grant — and on a resource the provider serves
  * (`/oauth/providers/google_calendar/calendars`). Declaring that in the manifest means inventing a
  * way to say "the options come from the grant of field X, resource Y", and one example is not
  * enough to design it: the second provider, Calendly, is what will say whether the shape is right.
  * Isolated here, that day costs this file and nothing else.
  */
defineProps({
  field: { type: Object, required: true },
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  options: { type: Array, default: () => [] },
  summary: { type: String, default: '' }
})
defineEmits(['update:modelValue'])
</script>

<template>
  <div v-if="options.length === 0" class="calendar-unavailable">
    <i class="pi pi-info-circle"></i>
    <span>{{ summary }}</span>
  </div>

  <Dropdown v-else
            :modelValue="modelValue"
            @update:modelValue="$emit('update:modelValue', $event)"
            :options="options"
            option-label="label"
            option-value="value"
            :disabled="disabled"
            :placeholder="summary"
            class="w-full"
            size="small" />
</template>

<style scoped lang="less">
.calendar-unavailable {
  display: flex;
  align-items: center;
  gap: .4rem;
  font-size: .85rem;
  opacity: .8;
}
</style>
