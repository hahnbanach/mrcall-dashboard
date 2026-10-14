<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useStore } from 'vuex'
import { useI18n } from 'vue-i18n'
import RestaurantApi from '@/utils/Restaurant'
import { isSessionEnded } from '@/firebase/session'
import { keyOf, addDays } from '@/utils/RestaurantModel'

/**
 * The guests' data of a restaurant whose page is off (R8): StarChat keeps the export and the erasure open whatever the
 * page switch says, because a business keeps its duties to its guests whatever it turned off. With the page off the
 * page itself is not reachable (no menu entry), so the two are offered here, in the skill's card, under the switch.
 *
 * Both need a signed-in person (the server answers `person_required` to a delegated token). The erasure cannot be
 * undone, so it is asked twice; the answer says how many bookings were cleared.
 */
const { t } = useI18n()
const route = useRoute()
const store = useStore()
const businessId = computed(() => (route && route.query ? String(route.query.id || '') : ''))
const user = computed(() => (store && store.state ? store.state.user : null))

const today = keyOf(new Date())
const from = ref(addDays(today, -30))
const to = ref(addDays(today, 60))
const phone = ref('')
const confirming = ref(false)
const busy = ref(false)
const message = ref(null)

function refusal (e) {
  const code = e && e.restaurant ? e.restaurant.code : null
  return t(code === 'person_required' ? 'components.restaurant.data.personRequired' : 'components.restaurant.answer.error')
}

async function exportCsv () {
  if (!user.value || !businessId.value || busy.value) return
  if (!from.value || !to.value || to.value < from.value) { message.value = { ok: false, text: t('components.restaurant.data.badRange') }; return }
  busy.value = true
  message.value = null
  try {
    const blob = await RestaurantApi.exportCsv(user.value, businessId.value, from.value, to.value)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob], { type: 'text/csv' }))
    a.download = t('components.restaurant.exportFile', { from: from.value, to: to.value })
    document.body.appendChild(a)
    a.click()
    a.remove()
    message.value = { ok: true, text: t('components.restaurant.data.exported') }
  } catch (e) {
    if (isSessionEnded(e)) return
    message.value = { ok: false, text: refusal(e) }
  } finally {
    busy.value = false
  }
}

async function erase () {
  const number = phone.value.trim()
  if (!user.value || !businessId.value || busy.value || number.replace(/\D/g, '').length < 6) return
  if (!confirming.value) { confirming.value = true; return }
  busy.value = true
  message.value = null
  try {
    const answer = await RestaurantApi.erase(user.value, businessId.value, number)
    message.value = { ok: true, text: t('components.restaurant.data.erased', { n: answer && answer.cleared ? answer.cleared : 0 }) }
    phone.value = ''
  } catch (e) {
    if (isSessionEnded(e)) return
    message.value = { ok: false, text: refusal(e) }
  } finally {
    busy.value = false
    confirming.value = false
  }
}
</script>

<template>
  <div class="restaurant-data-panel">
    <span class="config-label">{{ t('components.restaurant.data.title') }}</span>
    <small class="config-hint">{{ t('components.restaurant.data.intro') }}</small>
    <div class="data-row">
      <label>{{ t('components.restaurant.data.from') }} <input v-model="from" type="date" :aria-label="t('components.restaurant.data.from')"></label>
      <label>{{ t('components.restaurant.data.to') }} <input v-model="to" type="date" :aria-label="t('components.restaurant.data.to')"></label>
      <Button :label="t('components.restaurant.export')" size="small" outlined class="data-export" :disabled="busy" @click="exportCsv" />
    </div>
    <div class="data-row">
      <label>{{ t('components.restaurant.data.phone') }}
        <input v-model="phone" inputmode="tel" autocomplete="off" :aria-label="t('components.restaurant.data.phone')" @input="confirming = false"></label>
      <Button :label="confirming ? t('components.restaurant.data.eraseConfirm') : t('components.restaurant.data.erase')" size="small"
              severity="danger" :outlined="!confirming" class="data-erase" :disabled="busy || phone.replace(/\D/g, '').length < 6" @click="erase" />
    </div>
    <small v-if="confirming" class="config-hint data-warning">{{ t('components.restaurant.data.eraseWarning') }}</small>
    <small v-if="message" :class="['config-hint', message.ok ? 'data-ok' : 'data-error']" role="status">{{ message.text }}</small>
  </div>
</template>

<style scoped>
.restaurant-data-panel { display: flex; flex-direction: column; gap: 6px; }
.data-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.data-row input { border: 1px solid var(--p-content-border-color, #d1d5db); border-radius: 4px; padding: 4px 6px; }
.data-error { color: var(--red-500, #ef4444); }
.data-warning { color: var(--orange-600, #d97706); }
</style>
