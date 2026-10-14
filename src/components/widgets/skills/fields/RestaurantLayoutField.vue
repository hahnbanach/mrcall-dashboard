<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useStore } from 'vuex'
import { useI18n } from 'vue-i18n'
import RestaurantApi from '@/utils/Restaurant'
import { isSessionEnded } from '@/firebase/session'

/** The restaurant's room (zones, tables, joins) inside a skill's configuration: a summary and a link to the
  * page that edits it, never an editor here.
  *
  * WHERE THE ROOM IS READ FROM. Not from `modelValue`: the card draws an instance out of the business
  * variables, and StarChat never stores the `layout` section there (it lives in the restaurant book, the
  * configuration read fills it in, RestaurantLayoutSection). So the value this field receives is empty for
  * every restaurant, rooms included, and a summary drawn from it said "no room yet" to a restaurant with
  * one. The room is read from the restaurant's layout route, the book's own answer.
  *
  * It never emits a value: the card sends back exactly what it read, and a write without the section leaves
  * the room untouched.
  */
defineProps({
  field: { type: Object, required: true },
  modelValue: { type: [Object, String], default: null },
  disabled: { type: Boolean, default: false }
})

const { t } = useI18n()
const route = useRoute()
const store = useStore()

/** loading, then shown (a room or none), or unknown when it could not be read. */
const state = ref('loading')
const room = ref(null)

onMounted(async () => {
  const user = store && store.state ? store.state.user : null
  const businessId = route && route.query ? route.query.id : null
  if (!user || !businessId) { state.value = 'unknown'; return }
  try {
    room.value = await RestaurantApi.layout(user, String(businessId))
    state.value = 'shown'
  } catch (e) {
    // the session ended: the interceptor is already taking the person to sign-in, so nothing is said here
    if (isSessionEnded(e)) return
    console.warn('Restaurant room not read:', e.restaurant ? e.restaurant.code || e.restaurant.status : e)
    state.value = 'unknown'
  }
})

const summary = computed(() => {
  if (state.value === 'loading') return ''
  if (state.value === 'unknown') return t('widgets.agentSkills.restaurantLayout.unknown')
  const r = room.value
  if (!r || !r.tables.length) return t('widgets.agentSkills.restaurantLayout.empty')
  return t('widgets.agentSkills.restaurantLayout.summary', { zones: r.zones.length, tables: r.tables.filter(x => x.active).length })
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
