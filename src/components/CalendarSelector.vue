<template>
  <div class="calendar-selector">
    <h3 class="text-xl mb-3">{{ $t('components.connectCalendar.selectCalendarTitle') }}</h3>

    <div v-if="loading" class="loading">
      <ProgressSpinner />
      <p class="mt-2">{{ $t('components.connectCalendar.loadingCalendars') }}</p>
    </div>

    <div v-else-if="error" class="error-message">
      <p>{{ error }}</p>
    </div>

    <div v-else-if="calendars.length === 0" class="no-calendars">
      <p>{{ $t('components.connectCalendar.noCalendarsFound') }}</p>
    </div>

    <div v-else>
      <Listbox
        v-model="selectedCalendar"
        :options="calendars"
        optionLabel="summary"
        class="w-full mb-3"
        listStyle="max-height:250px"
      />
      <Button
        :label="$t('components.connectCalendar.confirmButton')"
        icon="pi pi-check"
        @click="confirmSelection"
        :disabled="!selectedCalendar"
        class="p-button-primary w-full"
      />
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import Button from 'primevue/button'
import Listbox from 'primevue/listbox'
import ProgressSpinner from 'primevue/progressspinner'

export default {
  name: 'CalendarSelector',

  components: {
    Button,
    Listbox,
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
  max-width: 400px;
  margin: 0 auto;

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 1rem 0;
  }

  .error-message {
    color: var(--red-500);
    text-align: center;
  }

  .no-calendars {
    text-align: center;
    color: var(--text-color-secondary);
  }
}
</style>
