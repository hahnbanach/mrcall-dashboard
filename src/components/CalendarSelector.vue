<template>
  <div class="calendar-selector">
    <!-- A card, because this is a decision and not a step of a wizard nobody is watching: it
         arrives at the end of a redirect to Google, on a page that until now was a bare list on
         white. What it picks is where appointments will be written, so it says so. -->
    <div class="selector-card">
      <div class="selector-head">
        <i class="pi pi-calendar selector-icon"></i>
        <div class="selector-head-text">
          <h3 class="selector-title">{{ $t('components.connectCalendar.selectCalendarTitle') }}</h3>
          <p class="selector-subtitle">{{ $t('components.connectCalendar.selectCalendarHint') }}</p>
        </div>
      </div>

      <div v-if="loading" class="selector-state">
        <ProgressSpinner style="width:38px;height:38px" strokeWidth="4" />
        <p>{{ $t('components.connectCalendar.loadingCalendars') }}</p>
      </div>

      <div v-else-if="error" class="selector-state selector-error">
        <i class="pi pi-exclamation-triangle"></i>
        <p>{{ error }}</p>
      </div>

      <div v-else-if="calendars.length === 0" class="selector-state">
        <i class="pi pi-inbox"></i>
        <p>{{ $t('components.connectCalendar.noCalendarsFound') }}</p>
      </div>

      <div v-else>
        <!-- Rows rather than a listbox: each one carries the calendar's name, whether it is the
             account's own, and a mark on the chosen one. A single-line label could not say which
             of five diaries the primary one is, which is the thing somebody needs to see here. -->
        <ul class="calendar-list">
          <li v-for="calendar in calendars" :key="calendar.id"
              :class="['calendar-row', { selected: selectedCalendar && selectedCalendar.id === calendar.id }]"
              @click="selectedCalendar = calendar">
            <i :class="selectedCalendar && selectedCalendar.id === calendar.id
                         ? 'pi pi-check-circle row-mark chosen' : 'pi pi-circle row-mark'"></i>
            <span class="row-name">{{ calendar.summary }}</span>
            <Tag v-if="calendar.primary" severity="info" class="row-tag"
                 :value="$t('components.connectCalendar.primaryCalendar')" />
          </li>
        </ul>

        <Button
          :label="$t('components.connectCalendar.confirmButton')"
          icon="pi pi-check"
          @click="confirmSelection"
          :disabled="!selectedCalendar"
          class="w-full selector-confirm"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'

export default {
  name: 'CalendarSelector',

  components: {
    Button,
    Tag,
    ProgressSpinner
  },

  props: {
    accessToken: {
      type: String,
      required: true
    }
  },

  emits: ['select'],

  setup(props, { emit }) {
    const calendars = ref([])
    const selectedCalendar = ref(null)
    const loading = ref(true)
    const error = ref(null)

    const fetchCalendars = async () => {
      try {
        loading.value = true
        const response = await axios.get(
          'https://www.googleapis.com/calendar/v3/users/me/calendarList',
          {
            params: { minAccessRole: 'writer' },
            headers: { Authorization: `Bearer ${props.accessToken}` }
          }
        )

        calendars.value = (response.data.items || []).map(cal => ({
          id: cal.id,
          summary: cal.summaryOverride || cal.summary,
          primary: cal.primary || false
        }))

        // Pre-select the primary calendar
        const primary = calendars.value.find(c => c.primary)
        if (primary) {
          selectedCalendar.value = primary
        } else if (calendars.value.length > 0) {
          selectedCalendar.value = calendars.value[0]
        }
      } catch (err) {
        console.error('Failed to fetch calendars:', err)
        error.value = err.response?.data?.error?.message || 'Failed to load calendars'
      } finally {
        loading.value = false
      }
    }

    const confirmSelection = () => {
      if (selectedCalendar.value) {
        emit('select', {
          id: selectedCalendar.value.id,
          summary: selectedCalendar.value.summary
        })
      }
    }

    onMounted(fetchCalendars)

    return {
      calendars,
      selectedCalendar,
      loading,
      error,
      confirmSelection
    }
  }
}
</script>

<style lang="less" scoped>
.calendar-selector {
  max-width: 460px;
  margin: 2rem auto;
}

.selector-card {
  background: var(--surface-card, #fff);
  border: 1px solid var(--surface-border, #e5e7eb);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .06), 0 8px 24px rgba(0, 0, 0, .05);
}

.selector-head {
  display: flex;
  align-items: flex-start;
  gap: .85rem;
  margin-bottom: 1.25rem;
}

.selector-icon {
  font-size: 1.5rem;
  color: var(--primary-color, #3b82f6);
  background: var(--primary-50, #eff6ff);
  border-radius: 10px;
  padding: .6rem;
  line-height: 1;
}

.selector-head-text { flex: 1; }

.selector-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.selector-subtitle {
  margin: .25rem 0 0;
  font-size: .85rem;
  color: var(--text-color-secondary, #6b7280);
  line-height: 1.35;
}

.selector-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .5rem;
  padding: 1.75rem 0;
  color: var(--text-color-secondary, #6b7280);
  text-align: center;

  i { font-size: 1.4rem; }
  p { margin: 0; }
}

.selector-error { color: var(--red-500, #ef4444); }

.calendar-list {
  list-style: none;
  margin: 0 0 1.1rem;
  padding: 0;
  max-height: 280px;
  overflow-y: auto;
}

.calendar-row {
  display: flex;
  align-items: center;
  gap: .7rem;
  padding: .7rem .8rem;
  border: 1px solid var(--surface-border, #e5e7eb);
  border-radius: 8px;
  cursor: pointer;
  transition: background-color .12s ease, border-color .12s ease;

  & + & { margin-top: .4rem; }

  &:hover { background: var(--surface-hover, #f9fafb); }

  &.selected {
    border-color: var(--primary-color, #3b82f6);
    background: var(--primary-50, #eff6ff);
  }
}

.row-mark {
  color: var(--surface-400, #9ca3af);
  font-size: 1.05rem;

  &.chosen { color: var(--primary-color, #3b82f6); }
}

.row-name {
  flex: 1;
  font-size: .92rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-tag { flex: 0 0 auto; }

.selector-confirm { justify-content: center; }
</style>
