<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

/** The restaurant's room (zones, tables, joins) inside a skill's configuration: a link to the page that
  * edits it, never an editor here.
  *
  * The section is stored by the restaurant book, not in the skill's variables: the configuration read fills
  * it from the book's own store, and a save that carries it unchanged writes nothing. Editing it here would
  * be a second editor of one room, so this widget draws the summary and the way to "Sala e tavoli", and it
  * never emits a value: the card sends back exactly what it read.
  */
const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { type: [Object, String], default: null },
  disabled: { type: Boolean, default: false }
})

const { t } = useI18n()
const route = useRoute()

const room = computed(() => {
  const v = props.modelValue
  if (v && typeof v === 'object') return v
  try { return v ? JSON.parse(v) : null } catch { return null }
})

const summary = computed(() => {
  const r = room.value
  if (!r || !Array.isArray(r.tables) || !r.tables.length) return t('widgets.agentSkills.restaurantLayout.empty')
  return t('widgets.agentSkills.restaurantLayout.summary', {
    zones: (r.zones || []).length,
    tables: r.tables.filter(x => x.active !== false).length
  })
})

const target = computed(() => ({
  path: route ? route.path : '/businessconfiguration',
  query: Object.assign({}, route ? route.query : {}, { section: '__RESTAURANT_BOOKING__', tab: 'room' })
}))
</script>

<template>
  <div class="restaurant-layout-field">
    <span class="config-hint">{{ summary }}</span>
    <router-link class="restaurant-layout-link" :to="target">
      <i class="pi pi-external-link" aria-hidden="true"></i> {{ t('widgets.agentSkills.restaurantLayout.open') }}
    </router-link>
  </div>
</template>

<style scoped>
.restaurant-layout-field { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.restaurant-layout-link { font-weight: 600; }
</style>
