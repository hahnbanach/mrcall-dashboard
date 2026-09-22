<script setup>
/* ------------------------------------------------------------- * Imports
 * ------------------------------------------------------------- */
import { reactive, ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import Calendar    from 'primevue/calendar'
import Button      from 'primevue/button'
import Fieldset    from 'primevue/fieldset'
import InputNumber from 'primevue/inputnumber'
import Popover     from 'primevue/popover'
import businessVariablesUtils from '@/utils/BusinessVariables'

/* ------------------------------------------------------------- * Props & localisation helper
 * ------------------------------------------------------------- */
const { t } = useI18n()
const model = defineModel()
const props  = defineProps({
  business: Object,
  variable: Object,
  slotDuration: {
    type: Number,
    default: 30 // fallback to 30 if not provided
  }
})

/* ------------------------------------------------------------- * Initialise the model if it is missing
 * ------------------------------------------------------------- */
onMounted(() => {
  if (model.value === undefined) {
    model.value = {}
  }
})

/* ------------------------------------------------------------- * Reactive data
 *   Data shape: { monday:[{start:'10:00',end:'10:30'}, …], … }
 * ------------------------------------------------------------- */
const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const slots    = reactive({})

// Copy back-end value → reactive local object
weekDays.forEach(day => {
  const src = (model.value && model.value[day]) ? model.value[day] : []
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
    model.value = dst
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

/** This day's hours onto every other day of the week, replacing what was there.
 *
 * Replacing and not merging: a merge would leave whatever was wrong on the other days sitting
 * beside what is right, and the reason somebody presses this is that the others should be like
 * this one. Copies are made per row, so editing Tuesday afterwards does not silently edit Monday.
 */
function copyDayToOthers(day) {
  const source = slots[day].map(row => ({ ...row }))
  weekDays.forEach(other => {
    if (other === day) return
    slots[other].splice(0, slots[other].length, ...source.map(row => ({ ...row })))
  })
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

/* ------------------------------------------------------------- * The wizard: a stretch, cut into slots
 *
 * Filling a morning by hand is the plus button pressed twenty times, and twenty chances to leave a
 * minute between two slots or to overlap them by five. Here the day is said once, from and to, and
 * the slots come out of the length: the same arithmetic the server does with `ranges`, so what the
 * grid says and what the caller is offered cannot drift apart.
 *
 * A SLOT THAT WOULD PASS THE END IS NOT MADE. 08:00 to 13:00 at fifteen minutes ends at 13:00
 * exactly; at fifty it stops at 12:30 and leaves the last twenty minutes alone, because half a slot
 * is not a slot anybody can book.
 * ------------------------------------------------------------- */
const wizard = ref(null)
const wizardDay = ref(null)
const wizardForm = reactive({ from: '08:00', to: '13:00', duration: 15 })

function minutesOf (hhmm) {
  if (typeof hhmm !== 'string' || hhmm.length < 4) return NaN
  const [h, m] = hhmm.split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN
}
function timeOf (minutes) {
  return `${padTime(Math.floor(minutes / 60))}:${padTime(minutes % 60)}`
}

/** The slots a stretch would produce. Computed rather than generated on the button, so the count is
 *  on the screen before anything is replaced. */
const wizardSlots = computed(() => {
  const from = minutesOf(wizardForm.from)
  const to = minutesOf(wizardForm.to)
  const step = Number(wizardForm.duration)
  if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(step) || step <= 0) return []
  const rows = []
  // The end never passes midnight: a slot belongs to the day it starts on, and a night that runs
  // past twelve is two rows on two days. The time pickers stop at 23:59, so this only guards the
  // arithmetic.
  const last = Math.min(to, 24 * 60)
  for (let at = from; at + step <= last; at += step) {
    rows.push({ start: timeOf(at), end: timeOf(at + step) })
  }
  return rows
})

function openWizard (event, day) {
  wizardDay.value = day
  wizardForm.duration = Number(props.slotDuration) > 0 ? Number(props.slotDuration) : 15
  // A day already filled opens on its own hours, so the wizard is also the way to re-cut a grid
  // whose appointment length has changed.
  const rows = slots[day]
  if (rows.length) {
    wizardForm.from = rows[0].start || wizardForm.from
    wizardForm.to = rows[rows.length - 1].end || wizardForm.to
  }
  wizard.value.show(event)
}

/** Replaces the day rather than adding to it, for the reason `copyDayToOthers` replaces: what is
 *  already there is what the wizard is being used to correct, and merging would leave it beside the
 *  new grid where nobody would notice it. The count is shown before the button is pressed. */
function applyWizard () {
  const day = wizardDay.value
  if (!day) return
  const rows = wizardSlots.value.map(row => ({ ...row }))
  slots[day].splice(0, slots[day].length, ...rows)
  wizard.value.hide()
}

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
</script>

<template>
  <!-- whole widget deactivated if variable isn’t modifiable -->
  <Fieldset
    :legend="variable.humanName || t('widgets.timeSlots.legend')"
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
          <!-- The wizard: say the stretch once and let the length cut it. -->
          <Button
            icon="pi pi-sparkles"
            class="p-button-sm ml-2 p-button-secondary"
            @click="openWizard($event, day)"
            :disabled="isDisabled"
            :title="t('widgets.timeSlots.wizard')"
          />
          <!-- Copy to the other days. A week of opening hours is usually one day repeated, and
               filling five identical days by hand is five chances to make them almost identical:
               a grid with Wednesday ending ten minutes early because somebody mistyped it is a
               grid nobody notices is wrong until a caller is offered a time that is refused. -->
          <Button
            v-if="slots[day].length"
            icon="pi pi-copy"
            class="p-button-sm ml-2 p-button-secondary"
            @click="copyDayToOthers(day)"
            :disabled="isDisabled"
            :title="t('widgets.timeSlots.copyToOthers')"
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

    <!-- One wizard for the seven days, opened against the button that was pressed. -->
    <Popover ref="wizard">
      <div class="slot-wizard">
        <div class="slot-wizard-title">
          {{ t('widgets.timeSlots.wizard') }}
          <span v-if="wizardDay" class="slot-wizard-day">{{ t('days.' + wizardDay) }}</span>
        </div>

        <div class="slot-wizard-row">
          <label>{{ t('widgets.timeSlots.wizardFrom') }}</label>
          <Calendar
            :modelValue="timeStringToDate(wizardForm.from)"
            @update:modelValue="val => wizardForm.from = dateToTimeString(val)"
            :timeOnly="true"
            hour-format="24"
            hide-on-date-time-select
            input-class="w-6rem"
          />
        </div>

        <div class="slot-wizard-row">
          <label>{{ t('widgets.timeSlots.wizardTo') }}</label>
          <Calendar
            :modelValue="timeStringToDate(wizardForm.to)"
            @update:modelValue="val => wizardForm.to = dateToTimeString(val)"
            :timeOnly="true"
            hour-format="24"
            hide-on-date-time-select
            input-class="w-6rem"
          />
        </div>

        <div class="slot-wizard-row">
          <label>{{ t('widgets.timeSlots.wizardDuration') }}</label>
          <InputNumber
            v-model="wizardForm.duration"
            :min="5"
            :max="1440"
            :step="5"
            showButtons
            size="small"
            input-class="w-4rem"
          />
        </div>

        <!-- What pressing the button will do, before it is pressed. -->
        <small v-if="wizardSlots.length" class="slot-wizard-preview">
          {{ t('widgets.timeSlots.wizardPreview', {
            count: wizardSlots.length,
            minutes: wizardForm.duration,
            first: wizardSlots[0].start,
            last: wizardSlots[wizardSlots.length - 1].end
          }) }}
        </small>
        <small v-else class="slot-wizard-preview text-danger-600">
          {{ t('widgets.timeSlots.wizardEmpty') }}
        </small>
        <small v-if="wizardDay && slots[wizardDay].length" class="slot-wizard-preview">
          {{ t('widgets.timeSlots.wizardOverwrite', { count: slots[wizardDay].length }) }}
        </small>

        <Button
          :label="t('widgets.timeSlots.wizardGenerate')"
          icon="pi pi-check"
          class="p-button-sm mt-2"
          :disabled="!wizardSlots.length"
          @click="applyWizard"
        />
      </div>
    </Popover>
  </Fieldset>
</template>

<style scoped lang="less">
/* nothing fancy – inherit from global theme */

.slot-wizard {
  display: flex;
  flex-direction: column;
  gap: .5rem;
  min-width: 15rem;

  .slot-wizard-title {
    font-weight: 600;
  }

  .slot-wizard-day {
    font-weight: 400;
    opacity: .7;
    margin-left: .35rem;
    text-transform: capitalize;
  }

  .slot-wizard-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .75rem;
  }

  .slot-wizard-preview {
    opacity: .8;
  }
}
</style>