<template>
  <div class="booking-panel" :data-booking="booking.id">
    <div class="panel-top">
      <div>
        <h2 ref="heading" tabindex="-1">{{ booking.name || $t("components.restaurant.walkInName") }}</h2>
        <span class="pill" :class="{ blue: booking.source === 'assistant' }">{{ $t(`components.restaurant.source.${booking.source}`) }}</span>
      </div>
      <button class="icon-btn" :aria-label="$t('components.restaurant.close')" @click="$emit('close')"><i class="pi pi-times" aria-hidden="true"></i></button>
    </div>
    <div class="when">{{ longDate }} · {{ fmt(booking.start) }}
      <small>{{ $t(`components.restaurant.service.${booking.service}`) }} · {{ $t("components.restaurant.people", { n: booking.party }) }} · {{ $t("components.restaurant.until", { time: fmt(booking.end) }) }}</small>
    </div>
    <div v-if="closed" class="callout red">
      {{ $t(booking.state === 'noshow' ? 'components.restaurant.panel.noShow' : booking.cancelledBy === 'caller' ? 'components.restaurant.panel.cancelledByCaller' : 'components.restaurant.panel.cancelled') }}
      <button v-if="booking.reinstatable" class="btn ghost small reinstate" :disabled="busy" @click="$emit('reinstate', booking)">{{ $t("components.restaurant.panel.reinstate") }}</button>
    </div>
    <div v-if="booking.state === 'requested'" class="callout amber">{{ $t("components.restaurant.panel.request") }}<template v-if="booking.requestReason">: {{ $t(`components.restaurant.reason.${booking.requestReason}`) }}</template></div>
    <div v-if="booking.allergies" class="callout red"><b>{{ $t("components.restaurant.allergies") }}:</b> {{ booking.allergies }}</div>
    <div v-if="booking.notes" class="callout amber">{{ booking.notes }}</div>
    <div v-if="booking.pastNoShows" class="callout amber">{{ $t("components.restaurant.panel.pastNoShows", { n: booking.pastNoShows }, booking.pastNoShows) }}</div>
    <div v-if="booking.overbooked" class="callout amber">{{ $t("components.restaurant.panel.overbooked") }}<template v-if="booking.intendedTables.length">
      {{ $t("components.restaurant.list.intended", { tables: intended }) }}</template></div>
    <div v-if="onClosedDay" class="callout red closed-day-note">{{ $t("components.restaurant.panel.closedDay") }}</div>
    <!-- the caller asked to change this booking by phone and the assistant could not (R8): what they asked, and the two actions -->
    <div v-if="changeRequest" class="callout amber change-request">
      <b>{{ $t("components.restaurant.change.asked") }}:</b> {{ fmt(changeRequest.start) }} · {{ $t("components.restaurant.people", { n: changeRequest.party }) }}<template v-if="changeRequest.notes"> · {{ changeRequest.notes }}</template>
      <div class="tb-row">
        <button class="btn small make-change" :disabled="busy || editing" @click="$emit('make-change', changeRequest)">{{ $t("components.restaurant.change.make") }}</button>
        <button class="btn ghost small close-request" :disabled="busy" @click="$emit('close-request', changeRequest)">{{ $t("components.restaurant.change.close") }}</button>
      </div>
    </div>
    <RestaurantDetailsEditor v-if="editing" :key="change ? 'change' : 'edit'" :booking="booking" :field-rules="fieldRules" :change="change"
                             :busy="busy" :message="message" @save="e => $emit('save-details', e)" @cancel="$emit('cancel-edit')" />
    <dl class="kv">
      <dt>{{ $t("components.restaurant.panel.table") }}</dt>
      <dd>{{ seats }}<template v-if="zoneName"> · {{ zoneName }}</template><template v-if="booking.pinned"> · {{ $t("components.restaurant.panel.pinnedShort") }}</template></dd>
      <dt>{{ $t("components.restaurant.panel.phone") }}</dt>
      <dd><a v-if="phone" class="restaurant-phone" :href="phone.uri">{{ phone.text }}</a><span v-else class="muted">{{ $t("components.restaurant.panel.noPhone") }}</span></dd>
    </dl>
    <div v-if="phone || hasCalls" class="contact-row">
      <a v-if="phone" class="btn ghost small" :href="phone.uri"><i class="pi pi-phone" aria-hidden="true"></i> {{ $t("components.restaurant.panel.call") }}</a>
      <a v-if="phone" class="btn ghost small" :href="phone.whatsapp" target="_blank" rel="noopener"><i class="pi pi-whatsapp" aria-hidden="true"></i> {{ $t("components.restaurant.panel.whatsapp") }}</a>
      <button v-if="hasCalls" class="btn ghost small read-call" @click="$emit('call', booking)"><i class="pi pi-headphones" aria-hidden="true"></i> {{ $t("components.restaurant.readCall") }}</button>
    </div>
    <template v-if="booking.state !== 'requested'">
      <div class="section-title">{{ $t("components.restaurant.panel.state") }}</div>
      <div class="states" role="group" :aria-label="$t('components.restaurant.panel.stateLabel')">
        <button v-for="st in ['booked', 'arrived', 'seated', 'left']" :key="st" :aria-pressed="booking.state === st" :disabled="closed || busy"
                @click="$emit('state', booking, st)">{{ $t(`components.restaurant.state.${st}`) }}</button>
      </div>
    </template>
    <div class="section-title">{{ $t("components.restaurant.panel.actions") }}</div>
    <div class="actions">
      <!-- staff correct a name, a phone, an allergy or a note, whoever made the booking (R8) -->
      <button class="btn ghost edit-details" :disabled="busy || editing || booking.state === 'block'" @click="$emit('edit')">{{ $t("components.restaurant.details.edit") }}</button>
      <button class="btn ghost" :disabled="closed || busy || booking.state === 'requested'" @click="$emit('move', booking)">{{ $t("components.restaurant.panel.move") }}</button>
      <button class="btn ghost" :disabled="closed || busy || booking.state === 'requested'" :title="$t('components.restaurant.panel.pinHint')"
              @click="$emit('pin', booking)">{{ $t(booking.pinned ? 'components.restaurant.panel.unpin' : 'components.restaurant.panel.pin') }}</button>
      <button class="btn ghost" :disabled="closed || busy || booking.state === 'seated' || booking.state === 'left' || booking.state === 'requested'"
              @click="$emit('no-show', booking)">{{ $t("components.restaurant.panel.noShowAction") }}</button>
      <button class="btn danger" :disabled="closed || busy" @click="$emit('cancel', booking)">{{ $t(booking.state === 'requested' ? 'components.restaurant.list.decline' : 'components.restaurant.panel.cancel') }}</button>
    </div>
    <p class="muted small-note">{{ $t("components.restaurant.panel.undoHint") }}<template v-if="booking.source === 'assistant'">{{ " " + $t("components.restaurant.panel.assistantSaid", { n: booking.party }) }}</template></p>
  </div>
</template>

<script>
import { fmt, seatLabel, callsOf } from "@/utils/RestaurantModel";
import { longDate, phoneOf } from "@/components/widgets/restaurant/format";
import RestaurantDetailsEditor from "@/components/widgets/restaurant/RestaurantDetailsEditor.vue";

/** One booking: when, who, where, the call that made it, its state in the evening and what can be done. */
export default {
  components: { RestaurantDetailsEditor },
  props: {
    booking: { type: Object, required: true },
    layout: { type: Object, required: true },
    date: { type: String, required: true },
    busy: { type: Boolean, default: false },
    /** The open call-back request about a change of this booking (R8), or null. */
    changeRequest: { type: Object, default: null },
    /** Whether the booking falls on a day or service closed after it was taken: staff call the guest. */
    onClosedDay: { type: Boolean, default: false },
    /** "What we ask for every booking": which details the editor draws and requires. */
    fieldRules: { type: Object, required: true },
    /** The details editor is open; with `change`, pre-filled from a call-back request (`changeOf`). */
    editing: { type: Boolean, default: false },
    change: { type: Object, default: null },
    message: { type: Object, default: null },
  },
  emits: ["close", "state", "pin", "no-show", "cancel", "move", "call", "reinstate", "make-change", "close-request", "edit", "cancel-edit", "save-details"],
  computed: {
    closed() {
      return this.booking.state === "cancelled" || this.booking.state === "noshow";
    },
    longDate() {
      return longDate(this.date, this.$i18n.locale);
    },
    intended() {
      return seatLabel(this.layout, this.booking.intendedTables || []);
    },
    seats() {
      return this.booking.tables.length ? seatLabel(this.layout, this.booking.tables) : this.$t("components.restaurant.noTable");
    },
    zoneName() {
      const z = this.layout.zones.find(x => x.id === this.booking.zone);
      return z ? z.name : this.booking.zoneName || "";
    },
    phone() {
      return phoneOf(this.booking.phone);
    },
    /** "Read the call" for a booking made or changed by phone; a staff booking or a walk-in has none. */
    hasCalls() {
      return callsOf(this.booking).length > 0;
    },
  },
  mounted() {
    this.$nextTick(() => this.$refs.heading && this.$refs.heading.focus({ preventScroll: true }));
  },
  methods: { fmt },
};
</script>
