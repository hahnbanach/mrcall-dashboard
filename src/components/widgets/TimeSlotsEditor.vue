<script setup>
/* ------------------------------------------------------------- * Imports
 * ------------------------------------------------------------- */
import { reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Calendar    from 'primevue/calendar'
import Button      from 'primevue/button'
import Fieldset    from 'primevue/fieldset'
import { useToast } from 'primevue/usetoast'
import businessVariablesUtils from '@/utils/BusinessVariables'

/* ------------------------------------------------------------- * Props & localisation helper
 * ------------------------------------------------------------- */
const { t } = useI18n()
const props  = defineProps({
  business: Object,
  variable: Object,
  slotDuration: {
    type: Number,
    default: 30 // fallback to 30 if not provided
  }
})
const toast  = useToast()

/* ------------------------------------------------------------- * Initialise the variable if it is missing
 * ------------------------------------------------------------- */
if (props.business.variables[props.variable.name] === undefined) {
  props.business.variables[props.variable.name] = {}
}

/* ------------------------------------------------------------- * Reactive data
 *   Data shape: { monday:[{start:'10:00',end:'10:30'}, …], … }
 * ------------------------------------------------------------- */
const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const slots    = reactive({})

// Copy back-end value → reactive local object
weekDays.forEach(day => {
  const src = props.business.variables[props.variable.name][day] ?? []
  slots[day] = src.map(r => ({ ...splitRange(r) }))      // [{start:'10:00',end:'10:30'}]
})

/* ------------------------------------------------------------- * Helpers
 * ------------------------------------------------------------- */
function splitRange (rangeStr) {
  // Already an object {start, end} — return as-is
  if (typeof rangeStr === 'object' && rangeStr !== null) {
    return { start: rangeStr.start || '', end: rangeStr.end || '' }
  }
  // Not a string — return empty slot
  if (typeof rangeStr !== 'string') {
    return { start: '', end: '' }
  }
  const [start, end] = rangeStr.split('-')
  return { start: start || '', end: end || '' }
}
function joinRange (obj) {
  return `${obj.start}-${obj.end}`
}

/* ------------------------------------------------------------- * Sync with business.variables whenever “slots” changes
 * ------------------------------------------------------------- */
watch(
  () => slots,                                               // deep watch
  () => {
    const dst = {}
    weekDays.forEach(day => {
      if (slots[day] && slots[day].length) {
        dst[day] = slots[day].map(s => joinRange(s))
      }
    })
    props.business.variables[props.variable.name] = dst
  },
  { deep: true, immediate: true }
)

/* ------------------------------------------------------------- * Whether the widget must be greyed-out
 * ------------------------------------------------------------- */
const isDisabled = computed(() => {
  const deps = props.variable.dependsOn || []
  return (
    !props.variable.modifiable ||
    businessVariablesUtils.checkIfDisabledByParents(
      props.business,
      props.variable,
      deps
    )
  )
})

/* ------------------------------------------------------------- * CRUD operations
 * ------------------------------------------------------------- */
function resetDay(day) {
  slots[day].splice(0)
}
function addSlot(day) {
  const daySlots = slots[day]
  let start, end

  if (daySlots.length === 0) {
    start = '08:00'
    // Use slotDuration here
    const startDate = new Date(0, 0, 0, 8, 0)
    const endDate = new Date(startDate)
    endDate.setMinutes(endDate.getMinutes() + props.slotDuration)
    end = formatTime(endDate)
  } else {
    // Get the last slot's end time
    const lastEnd = daySlots[daySlots.length - 1].end
    const [h, m] = lastEnd.split(':').map(Number)
    const startDate = new Date(0, 0, 0, h, m)
    // start at last end
    const endDate = new Date(startDate)
    endDate.setMinutes(endDate.getMinutes() + props.slotDuration)
    start = formatTime(startDate)
    end = formatTime(endDate)
  }

  daySlots.push({ start, end })
}

function removeSlot (day, idx)   { slots[day].splice(idx, 1) }

function padTime(num) {
  return num.toString().padStart(2, '0')
}

function formatTime(dateOrString) {
  if (!dateOrString) return ''
  if (typeof dateOrString === 'string') return dateOrString.length === 5 ? dateOrString : padTime(dateOrString)
  // If it's a Date object
  const h = padTime(dateOrString.getHours())
  const m = padTime(dateOrString.getMinutes())
  return `${h}:${m}`
}

function timeStringToDate(str) {
  if (!str) return null
  const [h, m] = str.split(':').map(Number)
  return new Date(1970, 0, 1, h, m)
}
function dateToTimeString(date) {
  if (!date) return null
  return formatTime(date)
}

/* ------------------------------------------------------------- * Validation (no empty, start<end, no overlaps)
 * ------------------------------------------------------------- */
function validateDay(day) {
  const rows = slots[day]

  // basic checks
  for (const r of rows) {
    if (!r.start || !r.end) return false
    if (r.start >= r.end)   return false
  }

  // overlap test
  const sorted = [...rows].sort((a, b) => a.start.localeCompare(b.start))
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1].end > sorted[i].start) return false
  }
  return true
}

function showError () {
  toast.add({
    severity: 'error',
    summary : t('error'),
    detail  : t('timeSlots.invalid'),
    life    : 3000
  })
}
</script>

<template>
  <!-- whole widget deactivated if variable isn’t modifiable -->
  <Fieldset
    :legend="variable.humanName"
    class="w-full"
    :toggleable="false"
    :pt="{
      root: { style: isDisabled ? 'opacity:.5;pointer-events:none' : '' }
    }"
  >
    <div class="grid gap-3">
      <div
        v-for="(day, dayIdx) in weekDays"
        :key="day"
        class="col-12"
      >
        <!-- DAY HEADER ------------------------------------------------------>
        <div class="flex align-items-center mb-2">
          <span class="font-bold text-lg text-capitalize">
            {{ t('days.' + day) }}
          </span>
          <!-- + button: always visible -->
          <Button
            icon="pi pi-plus"
            class="p-button-sm ml-auto"
            @click="addSlot(day)"
            :disabled="isDisabled"
          />
          <!-- Eraser button: only if there are slots -->
          <Button
            v-if="slots[day].length"
            icon="pi pi-eraser"
            class="p-button-sm ml-2 p-button-secondary"
            @click="resetDay(day)"
            :disabled="isDisabled"
          />
        </div>

        <!-- SLOTS LIST ------------------------------------------------------>
        <div v-if="slots[day].length">
          <div
            v-for="(row, idx) in slots[day]"
            :key="idx"
            class="flex mb-2"
          >
            <!-- start -->
            <Calendar
              :modelValue="timeStringToDate(row.start)"
              @update:modelValue="val => row.start = dateToTimeString(val)"
              selection-mode="single"
              :timeOnly="true"
              hour-format="24"
              hide-on-date-time-select
              input-class="w-6rem"
            />
            <span class="px-1">-</span>
            <!-- end -->
            <Calendar
              :modelValue="timeStringToDate(row.end)"
              @update:modelValue="val => row.end = dateToTimeString(val)"
              selection-mode="single"
              :timeOnly="true"
              hour-format="24"
              hide-on-date-time-select
              input-class="w-6rem"
            />
            <!-- remove button -->
            <Button
              icon="pi pi-minus"
              class="p-button-text p-button-danger p-button-sm ml-2"
              @click="removeSlot(day, idx)"
              :disabled="isDisabled"
            />
          </div>
          <!-- simple per-day validation -->
          <small
            v-if="!validateDay(day)"
            class="text-danger-600"
          >
            {{ t('timeSlots.invalid') }}
          </small>
          <!-- REPEATED BUTTONS AT END OF LIST -->
          <div class="flex align-items-center mt-2">
            <Button
              icon="pi pi-plus"
              class="p-button-sm"
              @click="addSlot(day)"
              :disabled="isDisabled"
            />
            <Button
              icon="pi pi-eraser"
              class="p-button-sm ml-2 p-button-secondary"
              @click="resetDay(day)"
              :disabled="isDisabled"
            />
          </div>
        </div>

        <!-- SEPARATOR BETWEEN DAYS -->
        <hr v-if="dayIdx < weekDays.length - 1" class="my-4" />
      </div>
    </div>
  </Fieldset>
</template>

<style scoped lang="less">
/* nothing fancy – inherit from global theme */
</style>