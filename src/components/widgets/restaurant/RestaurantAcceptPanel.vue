<template>
  <div class="accept-panel">
    <div class="panel-top">
      <div>
        <h2 ref="heading" tabindex="-1">{{ $t("components.restaurant.acceptFields.title", { name: request.name || $t("components.restaurant.walkInName") }) }}</h2>
        <span class="muted">{{ fmt(request.start) }} · {{ $t("components.restaurant.people", { n: request.party }) }}</span>
      </div>
      <button class="icon-btn" :aria-label="$t('components.restaurant.close')" @click="$emit('close')"><i class="pi pi-times" aria-hidden="true"></i></button>
    </div>
    <p class="callout amber">{{ $t("components.restaurant.acceptFields.intro", { fields: missingNames }) }}</p>
    <label v-for="k in missing" :key="k" class="field" :data-field="k">
      <span>{{ $t(`components.restaurant.ask.field.${k}`) }} *</span>
      <input v-model="guest[k]" autocomplete="off" :inputmode="k === 'phone' ? 'tel' : null" :class="{ invalid: tried && !guest[k].trim() }">
    </label>
    <button class="btn accept-with" :disabled="busy" @click="send">{{ $t("components.restaurant.acceptFields.accept") }}</button>
  </div>
</template>

<script>
import { fmt } from "@/utils/RestaurantModel";

/**
 * A request accepted with the fields this restaurant requires and the request lacks (R8): the page asks only for
 * those, and the accept carries them in the same call, so the booking never exists without them. The fields come
 * from the restaurant's own setting, or from the server's `missing_fields` refusal when it named them.
 */
export default {
  props: {
    request: { type: Object, required: true },
    missing: { type: Array, required: true },
    busy: { type: Boolean, default: false },
  },
  emits: ["close", "accept"],
  data() {
    return { guest: Object.fromEntries(this.missing.map(k => [k, ""])), tried: false };
  },
  computed: {
    missingNames() {
      return this.missing.map(k => this.$t(`components.restaurant.ask.field.${k}`)).join(", ");
    },
  },
  mounted() {
    this.$nextTick(() => this.$refs.heading && this.$refs.heading.focus({ preventScroll: true }));
  },
  methods: {
    fmt,
    send() {
      this.tried = true;
      if (this.missing.some(k => !this.guest[k].trim())) return;
      const guest = Object.fromEntries(this.missing.map(k => [k, this.guest[k].trim()]));
      this.$emit("accept", { request: this.request, guest });
    },
  },
};
</script>
