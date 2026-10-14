<template>
  <div class="details-editor" role="group" :aria-label="$t('components.restaurant.details.title')">
    <div class="section-title">{{ $t(change ? "components.restaurant.details.fromRequest" : "components.restaurant.details.title") }}</div>
    <!-- What this restaurant asks for every booking (R8): a field not asked is not drawn, a required one is marked. -->
    <label v-for="k in shown" :key="k" class="field" :data-detail="k">
      <span>{{ $t(`components.restaurant.ask.field.${k}`) }}<template v-if="required(k)"> *</template></span>
      <input :ref="k" v-model="form[k]" autocomplete="off" :inputmode="k === 'phone' ? 'tel' : null" :aria-required="required(k)"
             :class="{ invalid: tried && missing.includes(k) }">
      <small v-if="fieldRules[k] === 'not_asked'" class="muted not-asked-hint">{{ $t("components.restaurant.details.notAsked") }}</small>
    </label>
    <!-- From a call-back request: the move it asks for, or the late arrival it announces (the table stays); the book
         makes them when the request is applied. Not wanted, "close without changing" closes the request alone. -->
    <p v-if="change && change.move" class="apply-move">
      {{ $t("components.restaurant.details.applyMove", { day: changeDay, time: fmt(change.move.start), people: $t("components.restaurant.people", { n: change.move.party }) }) }}
    </p>
    <p v-if="change && change.late !== null" class="muted late-arrival">{{ $t("components.restaurant.details.late", { time: fmt(change.late) }) }}</p>
    <p v-if="tried && missing.length" class="err" role="alert">{{ $t("components.restaurant.answer.missingFields", { fields: missing.map(k => $t(`components.restaurant.ask.field.${k}`)).join(", ") }) }}</p>
    <!-- a refusal; "full" may be overridden as in every staff booking: the same values again, overbooked -->
    <div v-if="message" class="callout red refusal" role="alert">{{ message.text }}
      <button v-if="message.overridable" class="btn danger small book-anyway" :disabled="busy" @click="send(true)">{{ $t("components.restaurant.bookAnyway") }}</button>
    </div>
    <div class="tb-row">
      <button class="btn save-details" :disabled="busy || (!dirty && !change)" @click="send">{{ $t(change ? "components.restaurant.details.saveChange" : "components.restaurant.details.save") }}</button>
      <button class="btn ghost" :disabled="busy" @click="$emit('cancel')">{{ $t("components.restaurant.details.cancel") }}</button>
    </div>
  </div>
</template>

<script>
import { fmt, missingRequired } from "@/utils/RestaurantModel";
import { shortDate } from "@/components/widgets/restaurant/format";
import { ASKED_FIELDS } from "@/utils/Restaurant";

/** The guest's details staff may correct (R8), in this order; the zone is where the party sits, changed by a move. */
const DETAILS = ASKED_FIELDS.filter(k => k !== "zone");

/**
 * Staff correct a booking's name, phone, allergies and notes, whoever made it. The fields follow "what we ask for
 * every booking": not asked is not drawn, required is marked and cannot be emptied (StarChat refuses a write that
 * clears a required field, `missing_fields`).
 *
 * Opened from a call-back request about this booking (`change`, see `RestaurantModel.changeOf`), it is pre-filled
 * with what the caller asked and says the move or the late arrival the request makes; saving applies the request
 * (the book's one transaction), what staff changed going as their values over the asked ones.
 */
export default {
  props: {
    booking: { type: Object, required: true },
    fieldRules: { type: Object, required: true },
    /** What a call-back request asks of this booking, or null. */
    change: { type: Object, default: null },
    busy: { type: Boolean, default: false },
    message: { type: Object, default: null },
  },
  emits: ["save", "cancel"],
  data() {
    const b = this.booking;
    const from = this.change ? this.change.details : {};
    const pick = k => (from[k] !== undefined ? from[k] : b[k] || "");
    const form = Object.fromEntries(DETAILS.map(k => [k, pick(k)]));
    return {
      form,
      // what the editor opened with: the booking's values, or from a request what the caller asked
      initial: Object.assign({}, form),
      tried: false,
    };
  },
  computed: {
    /** The fields this restaurant asks; a field set to "not asked" is drawn only while the booking holds a value in
     *  it, so staff can read it and clear it (an allergy stored before the setting changed is a guest's data). */
    shown() {
      return DETAILS.filter(k => this.fieldRules[k] !== "not_asked" || String(this.booking[k] || "").trim());
    },
    /** The required fields this edit would empty. A required field the booking never had is not asked for here: the
     *  book checks only the fields a write sets or clears, so an older booking is never stuck (brief, R8). */
    missing() {
      return missingRequired(this.fieldRules, this.form, this.shown).filter(k => String(this.booking[k] || "").trim());
    },
    dirty() {
      return this.shown.some(k => this.form[k].trim() !== String(this.initial[k] || "").trim());
    },
    changeDay() {
      return this.change && this.change.move ? shortDate(this.change.move.date, this.$i18n.locale) : "";
    },
  },
  mounted() {
    const first = this.$refs[this.shown[0]];
    const el = Array.isArray(first) ? first[0] : first;
    if (el && el.focus) el.focus({ preventScroll: true });
  },
  methods: {
    fmt,
    required(k) {
      return this.fieldRules[k] === "required";
    },
    send(overbook = false) {
      this.tried = true;
      if (this.missing.length) return;
      // Only what staff changed travels; an emptied field travels as "", which the book reads as cleared. From a
      // request the comparison is with what the editor opened with, the caller's asked values: the book applies those
      // itself, and anything sent beside them is staff's override, which wins (StarChat .../apply).
      const guest = {};
      this.shown.forEach(k => { if (this.form[k].trim() !== String(this.initial[k] || "").trim()) guest[k] = this.form[k].trim(); });
      this.$emit("save", { guest, overbook: overbook === true });
    },
  },
};
</script>
