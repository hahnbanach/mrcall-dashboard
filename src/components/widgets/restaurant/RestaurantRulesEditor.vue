<template>
  <div class="rules-editor">
    <div class="callout blue cfg-intro">{{ $t("components.restaurant.rules.intro") }}
      <router-link v-if="skillsLink" class="linkish" :to="skillsLink">{{ $t("components.restaurant.rules.toSkill") }}</router-link></div>
    <div v-if="changes.length" class="callout amber pending" role="status">
      <b>{{ $t("components.restaurant.room.pending", { n: changes.length }) }}</b>
      <ul><li v-for="(c, i) in changes" :key="i">{{ c }}</li></ul>
    </div>
    <div class="issues">
      <div v-if="errors.length" class="callout red" role="alert">
        <b>{{ $t("components.restaurant.room.errors", { n: errors.length }) }}</b>
        <ul><li v-for="(e, i) in errors" :key="i">{{ e }}</li></ul>
      </div>
      <div v-if="warnings.length" class="callout amber" role="status">
        <b>{{ $t("components.restaurant.room.warnings") }}</b>
        <ul><li v-for="(w, i) in warnings" :key="i">{{ w.text }}
          <router-link v-if="w.to" class="linkish go" :to="w.to"> {{ w.label }}</router-link></li></ul>
      </div>
      <div v-if="saveMessage" class="callout" :class="saveMessage.ok ? 'blue' : 'red'" role="status">{{ saveMessage.text }}</div>
    </div>

    <section class="cfg-block card rules-hours">
      <h2>{{ $t("components.restaurant.rules.hours") }}</h2>
      <p class="muted">{{ $t("components.restaurant.wizard.hoursIntro") }}</p>
      <div v-for="s in ['lunch', 'dinner']" :key="s" class="wz-zone" :data-service="s">
        <h3>{{ $t(`components.restaurant.service.${s}`) }}</h3>
        <WeeklyHoursField :field="{ key: s }" :model-value="hours[s]" :slot-duration="numberOr('arrivalEveryMinutes')" @update:model-value="v => hours[s] = v" />
      </div>
    </section>

    <section v-for="group in GROUPS" :key="group.title" class="cfg-block card">
      <h2>{{ $t(`components.restaurant.rules.${group.title}`) }}</h2>
      <label v-for="k in group.keys" :key="k" class="field setting" :data-setting="k">
        <span>{{ $t(`components.restaurant.rules.field.${k}`) }}</span>
        <span class="tb-row"><input class="input" type="number" :min="limitsOf(k).min" :max="limitsOf(k).max" step="1"
                                    :value="values[k] === null ? '' : values[k]" :placeholder="String(defaultOf(k))"
                                    :class="{ invalid: !!errorOf(k), 'is-default': values[k] === null }" :aria-label="$t(`components.restaurant.rules.field.${k}`)"
                                    @input="e => values[k] = settingOf(e.target.value)"> {{ $t(`components.restaurant.rules.unit.${UNITS[k]}`) }}
          <span v-if="values[k] === null" class="pill default-tag">{{ $t("components.restaurant.room.defaultTag") }}</span></span>
        <small>{{ $t(`components.restaurant.rules.defaultIs.${UNITS[k]}`, { n: defaultOf(k) }) }}. {{ $t(`components.restaurant.rules.hint.${k}`, limitsOf(k)) }}</small>
      </label>
    </section>

    <RestaurantAskEditor v-model="asked" :stored="storedAsked" :allergies="instance.allergies" />

    <section class="cfg-block card closures" :aria-label="$t('components.restaurant.closures.title')">
      <h2>{{ $t("components.restaurant.closures.title") }}</h2>
      <p class="muted">{{ $t("components.restaurant.closures.intro") }}</p>
      <ul class="closure-list">
        <li v-for="(r, i) in closureRows" :key="`p-${i}`" class="closure-row" :data-closure="r.from">
          <span>{{ describe(r) }}</span>
          <button class="x-btn" :aria-label="$t('components.restaurant.closures.remove', { what: describe(r) })" @click="closureRows.splice(i, 1)">✕</button>
        </li>
        <li v-for="(c, i) in calendarRows" :key="`c-${i}`" class="closure-row from-calendar" :data-closure="c.date">
          <span>{{ describe({ from: c.date, to: c.date, service: c.service, zone: c.zone, windows: [] }) }}
            <small class="muted"> · «{{ c.title }}»</small></span>
          <span class="pill blue">{{ $t("components.restaurant.closures.fromCalendar") }}</span>
        </li>
        <li v-if="!closureRows.length && !calendarRows.length" class="muted">{{ $t("components.restaurant.closures.none") }}</li>
      </ul>
      <p v-if="calendar" class="calendar-age muted" role="status">{{ calendarAge }}</p>
      <p v-if="calendar" class="muted small-note">{{ $t("components.restaurant.closures.whereCalendar") }}</p>

      <div class="closure-add">
        <h3>{{ $t("components.restaurant.closures.add") }}</h3>
        <div class="tb-row">
          <label class="field"><span>{{ $t("components.restaurant.closures.from") }}</span><input v-model="form.from" type="date"></label>
          <label class="field"><span>{{ $t("components.restaurant.closures.to") }}</span><input v-model="form.to" type="date"></label>
          <label class="field"><span>{{ $t("components.restaurant.closures.kind") }}</span>
            <select v-model="form.kind"><option value="closed">{{ $t("components.restaurant.closures.closed") }}</option>
              <option value="open">{{ $t("components.restaurant.closures.special") }}</option></select></label>
          <label class="field"><span>{{ $t("components.restaurant.closures.service") }}</span>
            <select v-model="form.service">
              <option v-if="form.kind === 'closed'" value="">{{ $t("components.restaurant.closures.allDay") }}</option>
              <option value="lunch">{{ $t("components.restaurant.service.lunch") }}</option>
              <option value="dinner">{{ $t("components.restaurant.service.dinner") }}</option></select></label>
          <label v-if="form.kind === 'closed'" class="field"><span>{{ $t("components.restaurant.closures.where") }}</span>
            <select v-model="form.zone"><option value="">{{ $t("components.restaurant.closures.wholeRestaurant") }}</option>
              <option v-for="z in layout.zones" :key="z.id" :value="z.id">{{ z.name }}</option></select></label>
          <label v-else class="field"><span>{{ $t("components.restaurant.closures.windows") }}</span>
            <input v-model="form.windows" placeholder="19:30-21:30" :aria-label="$t('components.restaurant.closures.windows')"></label>
        </div>
        <p v-if="formError" class="err" role="alert">{{ formError }}</p>
        <button class="btn ghost small add-closure" @click="addClosure">{{ $t("components.restaurant.closures.addButton") }}</button>
      </div>
    </section>

    <div class="savebar">
      <span :class="changes.length ? 'warn' : 'muted'">{{ changes.length ? $t("components.restaurant.room.unsaved", { n: changes.length }) : $t("components.restaurant.room.noChanges") }}</span>
      <span class="spacer"></span>
      <button class="btn ghost" :disabled="!changes.length || saving" @click="discard">{{ $t("components.restaurant.room.discard") }}</button>
      <button class="btn save-rules" :disabled="!changes.length || errors.length > 0 || saving" @click="save">{{ $t("components.restaurant.room.save") }}</button>
    </div>
  </div>
</template>

<script>
import RestaurantApi from "@/utils/Restaurant";
import { isSessionEnded } from "@/firebase/session";
import WeeklyHoursField from "@/components/widgets/skills/fields/WeeklyHoursField.vue";
import RestaurantAskEditor from "@/components/widgets/restaurant/RestaurantAskEditor.vue";
import { clone, closuresOf, withClosures, sameClosures, fieldRulesOf, minFreeLimits } from "@/utils/RestaurantModel";
import { shortDate } from "@/components/widgets/restaurant/format";

/** The numbers of the restaurant this tab edits, grouped as the owner thinks of them. */
const GROUPS = [
  { title: "tables", keys: ["arrivalEveryMinutes", "tableMinutes2", "tableMinutes4", "tableMinutes6", "tableMinutesLarger", "coversPerArrival", "minFreeMinutes"] },
  { title: "reach", keys: ["horizonDays", "walkInMinutes"] },
];
const UNITS = { arrivalEveryMinutes: "minutes", tableMinutes2: "minutes", tableMinutes4: "minutes", tableMinutes6: "minutes",
  tableMinutesLarger: "minutes", coversPerArrival: "people", minFreeMinutes: "minutes", horizonDays: "days", walkInMinutes: "minutes" };

/** A weekly grid compared by content: the stored text and the editor's text may differ in key order only. */
const gridKey = v => {
  let o = v;
  if (typeof v === "string") { try { o = JSON.parse(v || "{}"); } catch { o = {}; } }
  const days = Object.keys(o || {}).filter(d => Array.isArray(o[d]) && o[d].length).sort();
  return JSON.stringify(days.map(d => [d, o[d]]));
};

/**
 * "Orari e regole": the restaurant's facts that are not the room (brief, addendum 2026-10-12 (2)). The hours, the
 * arrival step, table times, the kitchen's pace, the minimum free time, the book's horizon, the walk-in window,
 * "what we ask for every booking", and the one list of closures and special openings, the calendar's shown
 * read-only beside the page's own. Every setting here is marked `x-audience: page` in the manifest, so the skill
 * form never draws it; the assistant's policy (the largest party, notice, days ahead, prompts) is the form's, and
 * this tab links there instead of editing it.
 *
 * One save writes the instance (the settings, at its revision) and, when the closures changed, the layout (at its
 * revision). A setting left empty is not stored, and StarChat uses the manifest's default.
 */
export default {
  components: { WeeklyHoursField, RestaurantAskEditor },
  props: {
    user: { type: Object, required: true },
    businessId: { type: String, required: true },
    instance: { type: Object, required: true },
    rules: { type: Object, required: true },
    manifest: { type: Object, required: true },
    layout: { type: Object, required: true },
    skillsLink: { type: Object, default: null },
  },
  emits: ["saved", "instance-saved", "toast"],
  data() {
    return {
      GROUPS, UNITS,
      values: this.storedValues(),
      hours: { lunch: this.textOf(this.instance.params.lunch), dinner: this.textOf(this.instance.params.dinner) },
      asked: fieldRulesOf(this.instance.params, this.manifest),
      closureRows: closuresOf(this.layout),
      calendar: null,
      form: { from: "", to: "", kind: "closed", service: "", zone: "", windows: "" },
      formError: "",
      saving: false,
      saveMessage: null,
      serverErrors: [],
      serverWarnings: [],
    };
  },
  computed: {
    storedAsked() {
      return fieldRulesOf(this.instance.params, this.manifest);
    },
    numberChanges() {
      return Object.keys(UNITS).filter(k => this.values[k] !== this.storedOf(k));
    },
    hoursChanged() {
      return ["lunch", "dinner"].filter(s => gridKey(this.hours[s]) !== gridKey(this.instance.params[s]));
    },
    askedChanged() {
      return Object.keys(this.asked).filter(k => this.asked[k] !== this.storedAsked[k]);
    },
    closuresChanged() {
      return !sameClosures(this.closureRows, closuresOf(this.layout));
    },
    changes() {
      const out = [];
      this.hoursChanged.forEach(s => out.push(this.$t("components.restaurant.rules.changed.hours", { service: this.$t(`components.restaurant.service.${s}`) })));
      const shown = (k, v) => (v === null ? this.$t("components.restaurant.room.byDefault", { n: this.defaultOf(k) }) : v);
      this.numberChanges.forEach(k => out.push(this.$t("components.restaurant.rules.changed.number",
        { what: this.$t(`components.restaurant.rules.field.${k}`), from: shown(k, this.storedOf(k)), to: shown(k, this.values[k]) })));
      this.askedChanged.forEach(k => out.push(this.$t("components.restaurant.rules.changed.ask", { what: this.$t(`components.restaurant.ask.field.${k}`),
        to: this.$t(`components.restaurant.ask.rule.${this.asked[k]}`) })));
      if (this.closuresChanged) out.push(this.$t("components.restaurant.rules.changed.closures"));
      return out;
    },
    errors() {
      const out = Object.keys(UNITS).map(k => this.errorOf(k)).filter(Boolean);
      return out.concat(this.serverErrors);
    },
    warnings() {
      return this.serverWarnings;
    },
    calendarRows() {
      return this.calendar ? this.calendar.closures : [];
    },
    /** When the calendar's closures were read, and that the last read failed when it did: they are kept, with their age. */
    calendarAge() {
      const c = this.calendar;
      if (!c) return "";
      const when = t => (t ? new Date(t).toLocaleString(this.$i18n.locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
      if (!c.readAt && !c.triedAt) return this.$t("components.restaurant.closures.neverRead");
      const failed = c.outcome && c.outcome !== "ok" && c.triedAt && (!c.readAt || c.triedAt > c.readAt);
      const read = c.readAt ? this.$t("components.restaurant.closures.readAt", { when: when(c.readAt) }) : this.$t("components.restaurant.closures.neverRead");
      return failed ? `${read} ${this.$t("components.restaurant.closures.lastFailed", { when: when(c.triedAt) })}` : read;
    },
  },
  watch: {
    instance() {
      this.values = this.storedValues();
      this.hours = { lunch: this.textOf(this.instance.params.lunch), dinner: this.textOf(this.instance.params.dinner) };
      this.asked = fieldRulesOf(this.instance.params, this.manifest);
    },
    layout() {
      this.closureRows = closuresOf(this.layout);
    },
  },
  async mounted() {
    try {
      const read = await RestaurantApi.layoutWithCalendar(this.user, this.businessId);
      this.calendar = read.calendar;
    } catch (e) {
      console.warn("Restaurant calendar closures not read:", e.restaurant ? e.restaurant.code || e.restaurant.status : e);
    }
  },
  methods: {
    textOf(v) {
      return v && typeof v === "object" ? JSON.stringify(v) : v || "{}";
    },
    isSet(k) {
      const v = this.instance.params[k];
      return !(v === undefined || v === null || String(v).trim() === "");
    },
    storedOf(k) {
      return this.isSet(k) ? Number(this.instance.params[k]) : null;
    },
    storedValues() {
      return Object.fromEntries(Object.keys(UNITS).map(k => [k, this.storedOf(k)]));
    },
    defaultOf(k) {
      if (k === "minFreeMinutes") return this.rules.minFreeDefault;
      const m = this.manifest[k];
      return m && m.default !== undefined && m.default !== null ? Number(m.default) : "";
    },
    /** A value typed or, when empty, the default: what the hours editor's step is drawn with. */
    numberOr(k) {
      return this.values[k] === null ? Number(this.defaultOf(k)) || 15 : this.values[k];
    },
    limitsOf(k) {
      if (k === "minFreeMinutes") {
        const larger = this.values.tableMinutesLarger === null ? this.rules.tableMinutes.larger : this.values.tableMinutesLarger;
        return Object.assign({}, minFreeLimits(this.rules), { max: larger });
      }
      const m = this.manifest[k] || {};
      return { min: m.min, max: m.max };
    },
    errorOf(k) {
      const n = this.values[k];
      if (n === null) return "";
      const { min, max } = this.limitsOf(k);
      const ok = Number.isInteger(n) && (min === undefined || n >= min) && (max === undefined || n <= max);
      return ok ? "" : this.$t("components.restaurant.rules.outOfRange", { what: this.$t(`components.restaurant.rules.field.${k}`), min, max });
    },
    settingOf(text) {
      return String(text).trim() === "" ? null : Number(text);
    },
    zoneName(id) {
      const z = this.layout.zones.find(x => x.id === id);
      return z ? z.name : id;
    },
    describe(r) {
      const days = r.from === (r.to || r.from) ? shortDate(r.from, this.$i18n.locale)
        : `${shortDate(r.from, this.$i18n.locale)} - ${shortDate(r.to, this.$i18n.locale)}`;
      const service = r.service ? this.$t(`components.restaurant.service.${r.service}`) : this.$t("components.restaurant.closures.allDay");
      if (r.windows && r.windows.length) return this.$t("components.restaurant.closures.describeOpen", { days, service, windows: r.windows.join(", ") });
      const where = r.zone ? this.zoneName(r.zone) : this.$t("components.restaurant.closures.wholeRestaurant");
      return this.$t("components.restaurant.closures.describeClosed", { days, service, where });
    },
    addClosure() {
      const f = this.form;
      this.formError = "";
      if (!f.from) { this.formError = this.$t("components.restaurant.closures.needFrom"); return; }
      const to = f.to || f.from;
      if (to < f.from) { this.formError = this.$t("components.restaurant.closures.backwards"); return; }
      let windows = [];
      if (f.kind === "open") {
        windows = f.windows.split(/[,\s]+/).map(w => w.trim()).filter(Boolean);
        if (!f.service || !windows.length || !windows.every(w => /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(w))) {
          this.formError = this.$t("components.restaurant.closures.badWindows");
          return;
        }
      }
      this.closureRows.push({ from: f.from, to, service: f.service || null, zone: f.kind === "closed" ? f.zone || null : null, windows });
      this.form = { from: "", to: "", kind: "closed", service: "", zone: "", windows: "" };
    },
    discard() {
      this.values = this.storedValues();
      this.hours = { lunch: this.textOf(this.instance.params.lunch), dinner: this.textOf(this.instance.params.dinner) };
      this.asked = fieldRulesOf(this.instance.params, this.manifest);
      this.closureRows = closuresOf(this.layout);
      this.serverErrors = [];
      this.saveMessage = null;
    },
    instanceChanges() {
      const out = {};
      this.numberChanges.forEach(k => { out[k] = this.values[k] === null ? null : String(this.values[k]); });
      this.hoursChanged.forEach(s => { out[s] = this.hours[s]; });
      if (this.askedChanged.length) out.requiredFields = JSON.stringify(this.asked);
      return out;
    },
    /** A refusal or a warning of the instance save in the owner's words: by its code, naming the setting by its path. */
    diagnosticText(d) {
      const key = `components.restaurant.rules.code.${d.code}`;
      const what = this.whatOf(d.path);
      return this.$te(key) ? this.$t(key, Object.assign({ what }, d.values || {})) : this.$t("components.restaurant.rules.refusedField", { what });
    },
    whatOf(path) {
      const k = String(path || "").split("/")[1] || "";
      if (this.$te(`components.restaurant.rules.field.${k}`)) return this.$t(`components.restaurant.rules.field.${k}`);
      if (k === "requiredFields") return this.$t("components.restaurant.ask.title");
      if (k === "lunch" || k === "dinner") return this.$t(`components.restaurant.service.${k}`);
      return k;
    },
    async save() {
      if (this.errors.length || this.saving) return;
      this.saving = true;
      this.saveMessage = null;
      this.serverErrors = [];
      this.serverWarnings = [];
      const n = this.changes.length;
      try {
        const changes = this.instanceChanges();
        if (Object.keys(changes).length) {
          try {
            const answer = await RestaurantApi.saveInstance(this.user, this.businessId, this.instance, changes);
            this.serverWarnings = ((answer && answer.diagnostics) || []).filter(d => d.severity === "warning").map(d => ({
              text: this.diagnosticText(d),
              to: ["pace_below_party", "days_ahead_beyond_horizon"].includes(d.code) ? this.skillsLink : null,
              label: this.$t("components.restaurant.rules.inSkill") }));
          } catch (e) {
            // the session ended: the interceptor is already taking the person to sign-in, so nothing is said here
            if (isSessionEnded(e)) return;
            const r = e.restaurant || {};
            const diagnostics = r.body && Array.isArray(r.body.diagnostics) ? r.body.diagnostics.filter(d => (d.severity || "error") === "error") : [];
            if (r.status === 422 && diagnostics.length) this.serverErrors = diagnostics.map(d => this.diagnosticText(d));
            else this.saveMessage = { ok: false, text: this.$t(r.status === 409 ? "components.restaurant.room.configChanged" : "components.restaurant.answer.error") };
            if (r.status === 409) this.$emit("instance-saved");
            return;
          }
          this.$emit("instance-saved");
        }
        if (this.closuresChanged) {
          try {
            await RestaurantApi.saveLayout(this.user, this.businessId, this.layout.revision, withClosures(clone(this.layout), this.closureRows));
          } catch (e) {
            if (isSessionEnded(e)) return;
            const r = e.restaurant || {};
            this.saveMessage = { ok: false, text: this.$t(r.code === "stale" ? "components.restaurant.room.stale" : "components.restaurant.closures.refused") };
            if (r.code === "stale") this.$emit("saved");
            return;
          }
          this.$emit("saved");
        }
        this.$emit("toast", this.$t("components.restaurant.rules.savedToast", { n }));
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
