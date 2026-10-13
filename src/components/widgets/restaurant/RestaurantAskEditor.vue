<template>
  <section class="ask-editor card" :aria-label="$t('components.restaurant.ask.title')">
    <h2>{{ $t("components.restaurant.ask.title") }}</h2>
    <p class="muted">{{ $t("components.restaurant.ask.intro") }}</p>
    <table class="ask-table">
      <tbody>
        <tr class="ask-fixed">
          <th scope="row">{{ $t("components.restaurant.ask.fixed") }}</th>
          <td><span class="pill blue">{{ $t("components.restaurant.ask.always") }}</span></td>
        </tr>
        <tr v-for="k in ASKED_FIELDS" :key="k" :data-ask="k">
          <th scope="row" :id="`ask-${k}`">{{ $t(`components.restaurant.ask.field.${k}`) }}</th>
          <td>
            <div class="seg" role="radiogroup" :aria-labelledby="`ask-${k}`">
              <button v-for="r in FIELD_RULES" :key="r" type="button" role="radio" :aria-checked="modelValue[k] === r"
                      :disabled="disabled || unavailable(k, r)" :title="unavailable(k, r) ? $t('components.restaurant.ask.allergiesUnavailable') : null"
                      @click="set(k, r)">{{ $t(`components.restaurant.ask.rule.${r}`) }}</button>
            </div>
            <small v-if="k === 'phone' && modelValue.phone === 'not_asked'" class="ask-note">{{ $t("components.restaurant.ask.phoneNotAsked") }}</small>
            <small v-else-if="k === 'phone'" class="ask-note muted">{{ $t("components.restaurant.ask.phoneCaller") }}</small>
            <small v-if="k === 'allergies' && actsAsOptional" class="ask-note warn">{{ $t("components.restaurant.ask.allergiesActsOptional") }}</small>
            <small v-else-if="k === 'allergies' && !requiredAvailable" class="ask-note muted">{{ $t("components.restaurant.ask.allergiesUnavailable") }}</small>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="muted small-note">{{ $t("components.restaurant.ask.walkIn") }}</p>
  </section>
</template>

<script>
import { ASKED_FIELDS, FIELD_RULES } from "@/utils/Restaurant";

/**
 * "Cosa chiediamo per ogni prenotazione": per field, required, optional or not asked; day, time and covers are
 * always required and cannot be changed. StarChat's book enforces it from every source; the page only edits it.
 *
 * Allergies as "required" (every caller asked) depends on a server setting tied to an open legal point: where it is
 * off, the option is shown disabled with the reason, and a value already stored as required stays shown as it is,
 * with the note that here it acts as optional (brief, amended 2026-10-13). `allergies` is the server's answer
 * (`Restaurant.allergiesSettingOf`); null means the server did not say, read as "not available".
 */
export default {
  props: {
    modelValue: { type: Object, required: true },
    /** What is stored now, to tell a kept "required" from a newly chosen one. */
    stored: { type: Object, required: true },
    allergies: { type: Object, default: null },
    disabled: { type: Boolean, default: false },
  },
  emits: ["update:modelValue"],
  data() {
    return { ASKED_FIELDS, FIELD_RULES };
  },
  computed: {
    requiredAvailable() {
      return !!(this.allergies && this.allergies.requiredAvailable);
    },
    /** Stored as required where asking everybody is not available: kept, and read as optional by the book. */
    actsAsOptional() {
      return !this.requiredAvailable && this.modelValue.allergies === "required";
    },
  },
  methods: {
    /** "Required" for allergies is not offered here unless it is already stored so (then it may be kept). */
    unavailable(k, r) {
      return k === "allergies" && r === "required" && !this.requiredAvailable && this.stored.allergies !== "required";
    },
    set(k, r) {
      if (this.disabled || this.unavailable(k, r)) return;
      this.$emit("update:modelValue", Object.assign({}, this.modelValue, { [k]: r }));
    },
  },
};
</script>
