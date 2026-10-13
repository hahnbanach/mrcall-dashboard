<template>
  <div class="new-panel">
    <div class="panel-top">
      <div>
        <h2 ref="heading" tabindex="-1">{{ $t("components.restaurant.newb.title") }}</h2>
        <span class="muted">{{ fixed ? $t("components.restaurant.newb.fixed", { tables: fixed.label, zone: fixedZone, min: fixed.min, max: fixed.max }) : $t("components.restaurant.newb.auto") }}</span>
        <button v-if="fixed" class="btn ghost small" @click="seat(null)">{{ $t("components.restaurant.newb.letChoose") }}</button>
      </div>
      <button class="icon-btn" :aria-label="$t('components.restaurant.close')" @click="$emit('close')"><i class="pi pi-times" aria-hidden="true"></i></button>
    </div>

    <div v-if="isToday" class="walkin">
      <b>{{ $t("components.restaurant.newb.walkIn") }}</b> · {{ fixed ? $t("components.restaurant.newb.walkInAt", { tables: fixed.label }) : $t("components.restaurant.newb.walkInNow") }}
      <div class="row" role="group" :aria-label="$t('components.restaurant.newb.walkInParty')">
        <button v-for="n in walkInSizes" :key="n" class="btn walkin-party" :disabled="busy" @click="$emit('walk-in', { form, party: n })">{{ n }}</button>
      </div>
    </div>

    <div class="section-title">{{ $t("components.restaurant.newb.phoneBooking") }}</div>
    <div class="when">{{ longDate }} · {{ fmt(form.start) }}
      <small>{{ $t(`components.restaurant.service.${service}`) }} · {{ $t("components.restaurant.people", { n: form.party }) }} · {{ $t("components.restaurant.until", { time: fmt(form.start + minutes) }) }}</small>
    </div>
    <div class="field"><span>{{ $t("components.restaurant.newb.people") }}</span>
      <div class="pchips" role="group" :aria-label="$t('components.restaurant.newb.people')">
        <button v-for="n in 10" :key="n" :aria-pressed="form.party === n" @click="setParty(n)">{{ n }}</button>
        <input class="input party-more" type="number" min="1" max="200" :value="form.party" :aria-label="$t('components.restaurant.newb.peopleMore')"
               @change="e => setParty(Number(e.target.value))">
      </div>
    </div>
    <label class="field"><span>{{ $t("components.restaurant.newb.time") }}</span>
      <select :value="form.start" @change="e => setStart(Number(e.target.value))">
        <option v-for="t in times" :key="t" :value="t">{{ fmt(t) }}</option>
      </select>
    </label>
    <!-- What this restaurant asks for every booking (R8, "Cosa chiediamo"): a field not asked is not drawn, a required
         one is marked, and the book refuses the save without it whatever this form does. -->
    <label v-if="asks('name')" class="field" data-field="name"><span>{{ $t("components.restaurant.newb.name") }}<template v-if="required('name')"> *</template></span>
      <input ref="name" v-model="form.name" autocomplete="off" :aria-required="required('name')" :class="{ invalid: touched && missing.includes('name') }" @blur="touched = true">
    </label>
    <label v-if="asks('phone')" class="field" data-field="phone"><span>{{ $t("components.restaurant.newb.phone") }}<template v-if="required('phone')"> *</template></span>
      <input ref="phone" v-model="form.phone" inputmode="tel" autocomplete="off" :aria-required="required('phone')" :class="{ invalid: phoneShort || (touched && missing.includes('phone')) }">
    </label>
    <label v-if="asks('notes')" class="field" data-field="notes"><span>{{ $t("components.restaurant.newb.notes") }}<template v-if="required('notes')"> *</template></span>
      <input ref="notes" v-model="form.notes" autocomplete="off" :aria-required="required('notes')" :class="{ invalid: touched && missing.includes('notes') }"></label>
    <label v-if="asks('allergies')" class="field" data-field="allergies"><span>{{ $t("components.restaurant.newb.allergies") }}<template v-if="required('allergies')"> *</template></span>
      <input ref="allergies" v-model="form.allergies" autocomplete="off" :aria-required="required('allergies')" :class="{ invalid: touched && missing.includes('allergies') }"></label>
    <label v-if="asks('zone') && !fixed" class="field" data-field="zone"><span>{{ $t("components.restaurant.newb.zone") }}<template v-if="required('zone')"> *</template></span>
      <select ref="zone" v-model="form.zone" :aria-required="required('zone')" :class="{ invalid: touched && missing.includes('zone') }">
        <option value="">{{ $t("components.restaurant.newb.anyZone") }}</option>
        <option v-for="z in layout.zones" :key="z.id" :value="z.id">{{ z.name }}</option>
      </select></label>

    <div class="check" :class="hints.length ? 'bad' : 'ok'" role="status">
      <div v-for="(h, i) in hints" :key="i">{{ h }}</div>
      <template v-if="!hints.length">{{ fitLine }}</template>
      <div v-if="laterTimes.length" class="tb-row">
        <button v-for="t in laterTimes" :key="t" class="btn ghost small" @click="setStart(t)">{{ fmt(t) }}</button>
      </div>
    </div>
    <!-- What staff are warned of and not refused for (R8), before they confirm: "outside the hours" and "off the grid"
         are told apart. -->
    <div v-if="staffWarnings.length" class="callout amber staff-warnings" role="status">
      <div v-for="w in staffWarnings" :key="w" :data-warning="w">{{ $t(`components.restaurant.warning.${w}`) }}</div>
    </div>

    <div v-if="message" class="callout red refusal" role="alert">
      {{ message.text }}
      <div v-if="message.alternatives && message.alternatives.length" class="tb-row">
        {{ $t("components.restaurant.newb.alternatives") }}
        <button v-for="t in message.alternatives" :key="t" class="btn ghost small" @click="setStart(t)">{{ fmt(t) }}</button>
      </div>
      <button v-if="message.overridable" class="btn danger small" :disabled="busy" @click="save(true)">{{ $t("components.restaurant.bookAnyway") }}</button>
    </div>

    <button class="btn save-btn" :disabled="busy || phoneShort" @click="save(false)">
      {{ $t("components.restaurant.newb.save", { day: shortDate, time: fmt(form.start), people: $t("components.restaurant.people", { n: form.party }) }) }}
    </button>
  </div>
</template>

<script>
import { fmt, seatings, seatLabel, tablesFree, live, occupiedTables, tableMinutesFor, missingRequired } from "@/utils/RestaurantModel";
import { longDate, shortDate, refusalKey } from "@/components/widgets/restaurant/format";

/**
 * A booking taken by phone, at the door (walk-in), or a request accepted. The day and the time are shown
 * large before the save. Where the party sits is the server's answer, asked as the form changes; a table the
 * person chose is checked here only to say early what the server would say on save.
 */
export default {
  props: {
    draft: { type: Object, required: true },
    message: { type: Object, default: null },
    layout: { type: Object, required: true },
    date: { type: String, required: true },
    service: { type: String, required: true },
    win: { type: Object, default: null },
    rules: { type: Object, required: true },
    list: { type: Array, required: true },
    isToday: { type: Boolean, default: false },
    busy: { type: Boolean, default: false },
    findAnswer: { type: Object, default: null },
  },
  emits: ["close", "save", "walk-in", "changed"],
  data() {
    const d = this.draft;
    return {
      form: { tables: d.tables, start: d.start, party: d.party, name: d.name || "", phone: d.phone || "", notes: d.notes || "",
        allergies: d.allergies || "", zone: d.zone || "" },
      touched: false,
    };
  },
  computed: {
    longDate() {
      return longDate(this.date, this.$i18n.locale);
    },
    shortDate() {
      return shortDate(this.date, this.$i18n.locale);
    },
    minutes() {
      return tableMinutesFor(this.rules, this.form.party);
    },
    fixed() {
      const ids = this.form.tables;
      if (!ids) return null;
      const s = seatings(this.layout, this.date).find(x => x.ids.join() === ids.slice().sort((a, b) => a - b).join());
      const tables = ids.map(id => this.layout.tables.find(t => t.id === id)).filter(Boolean);
      return { ids, label: seatLabel(this.layout, ids), zone: tables[0] ? tables[0].zone : null,
        min: s ? s.min : Math.min(...tables.map(t => t.min)), max: s ? s.max : tables.reduce((a, t) => a + t.max, 0) };
    },
    fixedZone() {
      const z = this.fixed ? this.layout.zones.find(x => x.id === this.fixed.zone) : null;
      return z ? z.name : "";
    },
    times() {
      const out = [];
      if (this.win) for (let t = this.win.open; t <= this.win.last + 30; t += this.win.step) out.push(t);
      if (!out.includes(this.form.start)) out.push(this.form.start);
      return out.sort((a, b) => a - b);
    },
    walkInSizes() {
      const lo = this.fixed ? this.fixed.min : 1;
      const hi = this.fixed ? Math.min(this.fixed.max, 8) : 6;
      return Array.from({ length: Math.max(1, hi - lo + 1) }, (_, i) => lo + i);
    },
    phoneShort() {
      const d = this.form.phone.replace(/\D/g, "");
      return d.length > 0 && d.length < 6;
    },
    /** What the server would say about the chosen table, said before it is asked. */
    hints() {
      const out = [];
      const f = this.fixed;
      if (f && (this.form.party < f.min || this.form.party > f.max)) {
        out.push(this.$t("components.restaurant.newb.range", { tables: f.label, min: f.min, max: f.max }));
      } else if (f && !tablesFree(this.list, this.service, f.ids, this.form.start, this.form.start + this.minutes, null)) {
        const clash = live(this.list, this.service).find(b => occupiedTables(b).some(t => f.ids.includes(t)) &&
          b.start < this.form.start + this.minutes && b.end > this.form.start);
        out.push(this.$t("components.restaurant.newb.clash", { tables: f.label, name: clash ? clash.name || this.$t("components.restaurant.floor.blocked") : "",
          from: clash ? fmt(clash.start) : "", n: this.form.party, until: fmt(this.form.start + this.minutes) }));
      }
      if (!f && this.findAnswer && this.findAnswer.fits && !this.findAnswer.fits.length) {
        out.push(this.$t("components.restaurant.newb.noTable", { time: fmt(this.form.start), n: this.form.party }));
      }
      // A staff booking the book refuses whatever is typed (R8: a closed service, a past day, beyond the horizon, a
      // closed zone): said before the save, in the owner's words.
      const a = this.findAnswer;
      if (!f && a && a.staff && a.staff.refusal && a.staff.refusal !== "full") out.push(this.$t(refusalKey(a.staff.refusal)));
      if (this.touched) this.missing.forEach(k => out.push(this.$t("components.restaurant.newb.fieldMissing", { field: this.$t(`components.restaurant.ask.field.${k}`) })));
      if (this.phoneShort) out.push(this.$t("components.restaurant.newb.phoneShort"));
      return out;
    },
    /** The required fields still empty, by this restaurant's setting; a table chosen decides the zone. */
    missing() {
      return missingRequired(this.rules.requiredFields, Object.assign({}, this.form, { zone: this.fixed ? this.fixed.zone : this.form.zone }));
    },
    staffWarnings() {
      const a = this.findAnswer;
      return a && a.staff && !a.staff.refusal ? a.staff.warnings || [] : [];
    },
    fitLine() {
      if (this.fixed) return this.$t("components.restaurant.newb.freeFixed", { tables: this.fixed.label, zone: this.fixedZone, n: this.form.party });
      const a = this.findAnswer;
      if (!a || a.loading) return this.$t("components.restaurant.toolbar.asking");
      if (a.error) return this.$t("components.restaurant.newb.serverChooses");
      const best = a.fits[0];
      const z = this.layout.zones.find(x => x.id === best.zone);
      return this.$t("components.restaurant.newb.freeFixed", { tables: best.label, zone: z ? z.name : "", n: this.form.party });
    },
    laterTimes() {
      const a = this.findAnswer;
      return !this.fixed && a && a.fits && !a.fits.length ? (a.later || []).slice(0, 4) : [];
    },
  },
  mounted() {
    this.$nextTick(() => this.$refs.heading && this.$refs.heading.focus({ preventScroll: true }));
  },
  methods: {
    fmt,
    setParty(n) {
      if (!(n >= 1)) return;
      this.form.party = Math.floor(n);
      this.$emit("changed", this.form);
    },
    setStart(t) {
      this.form.start = t;
      this.$emit("changed", this.form);
    },
    seat(ids) {
      this.form.tables = ids;
      this.$emit("changed", this.form);
    },
    asks(k) {
      return this.rules.requiredFields[k] !== "not_asked";
    },
    required(k) {
      return this.rules.requiredFields[k] === "required";
    },
    save(overbook) {
      this.touched = true;
      if (this.missing.length) {
        const first = this.$refs[this.missing[0]];
        if (first && first.focus) first.focus();
        return;
      }
      this.$emit("save", { form: this.form, overbook });
    },
  },
};
</script>
