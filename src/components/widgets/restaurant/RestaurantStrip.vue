<template>
  <section class="strip" :aria-label="$t('components.restaurant.strip.label')">
    <div class="strip-head">
      <h2>{{ $t("components.restaurant.strip.title") }}</h2>
      <div class="seg" role="group" :aria-label="$t('components.restaurant.strip.period')">
        <button :aria-pressed="mode === '14'" @click="$emit('mode', '14')">{{ $t("components.restaurant.strip.days14") }}</button>
        <button :aria-pressed="mode === 'month'" @click="$emit('mode', 'month')">{{ $t("components.restaurant.strip.month") }}</button>
      </div>
      <button class="icon-btn" :aria-label="$t(mode === '14' ? 'components.restaurant.strip.prevWeek' : 'components.restaurant.strip.prevMonth')"
              @click="$emit('shift', mode === '14' ? -7 : -1)"><i class="pi pi-chevron-left" aria-hidden="true"></i></button>
      <button class="icon-btn" :aria-label="$t(mode === '14' ? 'components.restaurant.strip.nextWeek' : 'components.restaurant.strip.nextMonth')"
              @click="$emit('shift', mode === '14' ? 7 : 1)"><i class="pi pi-chevron-right" aria-hidden="true"></i></button>
      <span class="muted">{{ title }}</span>
      <div class="legend">
        <span><i class="st-free"></i>{{ $t("components.restaurant.strip.free") }}</span>
        <span><i class="st-limited"></i>{{ $t("components.restaurant.strip.limited") }}</span>
        <span><i class="st-full"></i>{{ $t("components.restaurant.strip.full") }}</span>
        <span><i class="st-closed"></i>{{ $t("components.restaurant.strip.closed") }}</span>
        <span>{{ $t("components.restaurant.strip.legend") }}</span>
      </div>
    </div>
    <div class="strip-days" :class="{ month: mode === 'month' }">
      <template v-if="mode === 'month'">
        <div v-for="d in weekdays" :key="d" class="month-dow">{{ d }}</div>
      </template>
      <template v-for="c in cells" :key="c.key">
        <div v-if="c.blank" class="dcell blank"></div>
        <button v-else class="dcell" :class="{ sel: c.sel, today: c.today }" :data-date="c.key" :title="titleOf(c)"
                :aria-label="ariaOf(c)" :aria-pressed="c.sel" @click="$emit('go-day', c.key)">
          <span class="dc-date"><b>{{ dayNumber(c.key) }}</b>{{ weekdayShort(c.key) }}<template v-if="c.today"> · {{ $t("components.restaurant.strip.today") }}</template></span>
          <span v-for="s in ['lunch', 'dinner']" :key="s" class="dc-svc" :class="`st-${c.services[s].status}`" :data-service="s">
            <span class="dc-l"><span class="dc-s">{{ $t(`components.restaurant.strip.letter.${s}`) }}</span><b>{{ mainOf(c.services[s]) }}</b></span>
            <small v-if="c.services[s].covers !== undefined && c.services[s].status !== 'closed'">{{ $t("components.restaurant.strip.covers", { n: c.services[s].covers }) }}</small>
          </span>
        </button>
      </template>
    </div>
  </section>
</template>

<script>
import { dateOf, addDays } from "@/utils/RestaurantModel";
import { longDate } from "@/components/widgets/restaurant/format";

/** "Cosa resta libero": fourteen days or a month, lunch and dinner, coloured by what the server's period
 *  read says still fits, with the largest party ("max 6") and the covers taken. A day is one tap. */
export default {
  props: {
    cells: { type: Array, required: true },
    mode: { type: String, required: true },
    title: { type: String, default: "" },
  },
  emits: ["go-day", "shift", "mode"],
  computed: {
    weekdays() {
      // a Monday first week, in the owner's language
      const monday = "2024-01-01";
      return Array.from({ length: 7 }, (_, i) => dateOf(addDays(monday, i)).toLocaleDateString(this.$i18n.locale, { weekday: "short" }));
    },
  },
  methods: {
    dayNumber(key) {
      return dateOf(key).getDate();
    },
    weekdayShort(key) {
      return dateOf(key).toLocaleDateString(this.$i18n.locale, { weekday: "short" });
    },
    mainOf(s) {
      if (s.status === "free" || s.status === "limited") return this.$t("components.restaurant.strip.max", { n: s.max });
      return this.$t(`components.restaurant.strip.main.${s.status}`);
    },
    ariaOf(c) {
      return [longDate(c.key, this.$i18n.locale)].concat(["lunch", "dinner"].map(s =>
        `${this.$t(`components.restaurant.service.${s}`)}: ${this.mainOf(c.services[s])}`)).join(", ");
    },
    /** The times a party of 2, 4 and 6 can still book, as the server listed them. */
    titleOf(c) {
      return ["lunch", "dinner"].map(s => {
        const sv = c.services[s];
        if (!sv.bookable) return `${this.$t(`components.restaurant.service.${s}`)}: ${this.mainOf(sv)}`;
        const part = n => `${this.$t("components.restaurant.strip.forN", { n })} ${(sv.bookable[n] || []).join(", ") || this.$t("components.restaurant.strip.noTime")}`;
        return `${this.$t(`components.restaurant.service.${s}`)}: ${[2, 4, 6].map(part).join("; ")}`;
      }).join("\n");
    },
  },
};
</script>
