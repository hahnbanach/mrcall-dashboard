<template>
  <div class="day-nav" :class="{ compact }">
    <button class="icon-btn" :aria-label="$t('components.restaurant.day.prev')" @click="$emit('go-day', shift(-1))"><i class="pi pi-chevron-left" aria-hidden="true"></i></button>
    <component :is="compact ? 'span' : 'h2'" class="day-title">{{ title }}</component>
    <button class="icon-btn" :aria-label="$t('components.restaurant.day.next')" @click="$emit('go-day', shift(1))"><i class="pi pi-chevron-right" aria-hidden="true"></i></button>
    <button class="btn ghost small" :disabled="date === today" @click="$emit('go-day', today)">{{ $t("components.restaurant.day.today") }}</button>
    <input class="date-input" type="date" :value="date" :aria-label="$t('components.restaurant.day.pick')" @change="e => e.target.value && $emit('go-day', e.target.value)">
  </div>
</template>

<script>
import { addDays } from "@/utils/RestaurantModel";
import { longDate, shortDate } from "@/components/widgets/restaurant/format";

/** A day and the ways to change it: the previous and next day, back to today, and a date picker. The day view
 *  and the room editor's evening preview both move through days with it. `compact` writes the day short, for a
 *  narrow column. */
export default {
  props: {
    date: { type: String, required: true },
    today: { type: String, required: true },
    compact: { type: Boolean, default: false },
  },
  emits: ["go-day"],
  computed: {
    title() {
      return (this.compact ? shortDate : longDate)(this.date, this.$i18n.locale);
    },
  },
  methods: {
    shift(n) {
      return addDays(this.date, n);
    },
  },
};
</script>
