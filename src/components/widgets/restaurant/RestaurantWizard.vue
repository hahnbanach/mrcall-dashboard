<template>
  <div class="wizard">
    <div class="card">
      <h2>{{ $t("components.restaurant.wizard.title") }}</h2>
      <p class="muted">{{ $t("components.restaurant.wizard.intro") }}</p>
      <div class="steps">
        <div v-for="(s, i) in stepNames" :key="s" class="step" :class="{ on: i === stepIndex, done: i < stepIndex }">{{ i + 1 }}. {{ s }}</div>
      </div>

      <!-- the rules first: without arrival times the server cannot read them, and no room can be saved -->
      <template v-if="step === 'hours'">
        <h3>{{ $t("components.restaurant.wizard.hoursTitle") }}</h3>
        <p class="muted">{{ $t("components.restaurant.wizard.hoursIntro") }}</p>
        <div v-for="s in ['lunch', 'dinner']" :key="s" class="wz-zone" :data-service="s">
          <h3>{{ $t(`components.restaurant.service.${s}`) }}</h3>
          <WeeklyHoursField :field="{ key: s }" :model-value="hours[s]" :slot-duration="rules.step" @update:model-value="v => hours[s] = v" />
        </div>
        <p v-if="message" class="err" role="alert">{{ message }}</p>
      </template>

      <template v-else-if="step === 'zones'">
        <h3>{{ $t("components.restaurant.wizard.zonesTitle") }}</h3>
        <p class="muted">{{ $t("components.restaurant.wizard.zonesIntro") }}</p>
        <div class="zchips">
          <button v-for="z in zoneChoices" :key="z" :aria-pressed="W.zones.includes(z)" @click="toggleZone(z)">{{ z }}</button>
        </div>
        <div class="wz-row">
          <input v-model="custom" class="input" :placeholder="$t('components.restaurant.wizard.otherZone')" :aria-label="$t('components.restaurant.wizard.otherZoneLabel')"
                 @keydown.enter.prevent="addCustom">
          <button class="btn ghost small" @click="addCustom">{{ $t("components.restaurant.wizard.add") }}</button>
        </div>
        <p v-if="!W.zones.length" class="err">{{ $t("components.restaurant.wizard.zonesNone") }}</p>
      </template>

      <template v-else-if="step === 'tables'">
        <h3>{{ $t("components.restaurant.wizard.tablesTitle") }}</h3>
        <p class="muted">{{ $t("components.restaurant.wizard.tablesIntro") }}</p>
        <div v-for="z in W.zones" :key="z" class="wz-zone" :data-zone="z">
          <h3>{{ z }}</h3>
          <div v-for="(r, i) in W.rows[z]" :key="i" class="wz-row">
            <input v-model.number="r.n" type="number" min="1" max="40" :aria-label="$t('components.restaurant.wizard.howMany', { zone: z })">
            {{ $t("components.restaurant.wizard.tablesOf") }}
            <input v-model.number="r.size" type="number" min="1" max="30" :aria-label="$t('components.restaurant.wizard.seats', { zone: z })">
            {{ $t("components.restaurant.wizard.seatsWord") }}
            <button class="x-btn" :aria-label="$t('components.restaurant.wizard.rowDelete')" @click="W.rows[z].splice(i, 1)">✕</button>
          </div>
          <button class="btn ghost small" @click="W.rows[z].push({ n: 2, size: 4 })"><i class="pi pi-plus" aria-hidden="true"></i> {{ $t("components.restaurant.wizard.rowAdd") }}</button>
          <p class="muted">
            <template v-if="namesOf(z).length">{{ $t("components.restaurant.wizard.names", { n: namesOf(z).length, names: namesOf(z).join(", ") }) }}</template>
            <span v-else class="err">{{ $t("components.restaurant.wizard.noTables") }}</span>
          </p>
        </div>
        <p><b>{{ $t("components.restaurant.wizard.total", { n: built.tables.length, seats: built.tables.reduce((a, t) => a + t.max, 0) }) }}</b></p>
      </template>

      <template v-else>
        <h3>{{ $t("components.restaurant.wizard.joinsTitle") }}</h3>
        <p class="muted">{{ $t("components.restaurant.wizard.joinsIntro") }}</p>
        <template v-for="z in W.zones" :key="z">
          <label v-if="pairsOf(z).length" class="wz-zone wz-pair">
            <input v-model="W.pairs[z]" type="checkbox"> <b>{{ z }}</b>: {{ $t("components.restaurant.wizard.pair") }}<br>
            <small>{{ pairsOf(z).join(", ") }}</small>
          </label>
        </template>
        <p v-if="message" class="err" role="alert">{{ message }}</p>
      </template>

      <div class="wz-nav">
        <button v-if="stepIndex > firstStep" class="btn ghost left" @click="back">{{ $t("components.restaurant.wizard.back") }}</button>
        <template v-if="step === 'joins'">
          <button class="btn ghost" :disabled="saving" @click="finish(true)">{{ $t("components.restaurant.wizard.skip") }}</button>
          <button class="btn wizard-done" :disabled="saving" @click="finish(false)">{{ $t("components.restaurant.wizard.done") }}</button>
        </template>
        <button v-else class="btn wizard-next" :disabled="!canNext || saving" @click="next">{{ $t("components.restaurant.wizard.next") }}</button>
      </div>
    </div>
  </div>
</template>

<script>
import { isSessionEnded } from "@/firebase/session";
import RestaurantApi from "@/utils/Restaurant";
import WeeklyHoursField from "@/components/widgets/skills/fields/WeeklyHoursField.vue";
import { hasHours, wizardLayout, seatLabel } from "@/utils/RestaurantModel";

const STEPS = ["hours", "zones", "tables", "joins"];

/**
 * The first run of a restaurant without tables: the hours if the instance has none (the server needs
 * readable rules before it saves a first room), then zones, tables per size, and optional pairs of tables to
 * join. The room is built here and saved as the first layout; the server numbers the tables.
 */
export default {
  components: { WeeklyHoursField },
  props: {
    user: { type: Object, required: true },
    businessId: { type: String, required: true },
    instance: { type: Object, required: true },
    rules: { type: Object, required: true },
  },
  emits: ["instance-saved", "done"],
  data() {
    const first = this.$t("components.restaurant.wizard.defaultZone");
    return {
      step: hasHours(this.rules) ? "zones" : "hours",
      firstStep: hasHours(this.rules) ? 1 : 0,
      hours: { lunch: JSON.stringify(this.rules.lunch || {}), dinner: JSON.stringify(this.rules.dinner || {}) },
      W: { zones: [first], rows: { [first]: [{ n: 6, size: 2 }, { n: 4, size: 4 }] }, pairs: {} },
      custom: "",
      saving: false,
      message: "",
    };
  },
  computed: {
    stepIndex() {
      return STEPS.indexOf(this.step);
    },
    stepNames() {
      return STEPS.map(s => this.$t(`components.restaurant.wizard.step.${s}`));
    },
    zoneChoices() {
      const suggested = this.$t("components.restaurant.wizard.suggestedZones").split(",").map(s => s.trim()).filter(Boolean);
      return [...new Set([...suggested, ...this.W.zones])];
    },
    built() {
      return wizardLayout(this.W);
    },
    canNext() {
      if (this.step === "hours") return this.hoursValid;
      if (this.step === "zones") return this.W.zones.length > 0;
      if (this.step === "tables") return this.built.tables.length > 0 && this.W.zones.every(z => (this.W.rows[z] || []).some(r => r.n > 0));
      return true;
    },
    hoursValid() {
      const parse = v => { try { return JSON.parse(v || "{}") || {}; } catch { return {}; } };
      return hasHours({ lunch: parse(this.hours.lunch), dinner: parse(this.hours.dinner) });
    },
  },
  methods: {
    toggleZone(z) {
      if (this.W.zones.includes(z)) this.W.zones = this.W.zones.filter(x => x !== z);
      else {
        this.W.zones.push(z);
        if (!this.W.rows[z]) this.W.rows[z] = [{ n: 4, size: 2 }];
      }
    },
    addCustom() {
      const z = this.custom.trim();
      if (!z) return;
      if (!this.W.zones.includes(z)) {
        this.W.zones.push(z);
        this.W.rows[z] = [{ n: 4, size: 2 }];
      }
      this.custom = "";
    },
    zoneIdOf(z) {
      return this.built.zones[this.W.zones.indexOf(z)].id;
    },
    namesOf(z) {
      const id = this.zoneIdOf(z);
      return this.built.tables.filter(t => t.zone === id).map(t => t.name);
    },
    pairsOf(z) {
      const L = wizardLayout(Object.assign({}, this.W, { pairs: { [z]: true } }));
      const id = L.zones[this.W.zones.indexOf(z)].id;
      return L.joins.filter(j => L.tables.find(t => t.id === j.tables[0]).zone === id).map(j => seatLabel(L, j.tables));
    },
    back() {
      this.message = "";
      this.step = STEPS[this.stepIndex - 1];
    },
    async next() {
      this.message = "";
      if (this.step === "hours") {
        this.saving = true;
        try {
          await RestaurantApi.saveInstance(this.user, this.businessId, this.instance, { lunch: this.hours.lunch, dinner: this.hours.dinner });
          this.$emit("instance-saved");
        } catch (e) {
          // the session ended: the interceptor is already taking the person to sign-in, so nothing is said here
          if (isSessionEnded(e)) return;
          const r = e.restaurant || {};
          this.message = this.$t(r.status === 409 ? "components.restaurant.room.configChanged" : "components.restaurant.wizard.hoursRefused");
          if (r.status === 409) this.$emit("instance-saved");
          return;
        } finally {
          this.saving = false;
        }
      }
      this.step = STEPS[this.stepIndex + 1];
    },
    async finish(skipJoins) {
      this.saving = true;
      this.message = "";
      try {
        const layout = wizardLayout(skipJoins ? Object.assign({}, this.W, { pairs: {} }) : this.W);
        await RestaurantApi.saveLayout(this.user, this.businessId, null, layout);
        this.$emit("done");
      } catch (e) {
        if (isSessionEnded(e)) return;
        const r = e.restaurant || {};
        if (r.status === 409 && r.code === "not_configured") {
          this.message = this.$t("components.restaurant.room.needsHours");
          this.firstStep = 0;
          this.step = "hours";
        } else {
          this.message = this.$t(r.status === 422 ? "components.restaurant.wizard.refused" : "components.restaurant.answer.error");
        }
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
