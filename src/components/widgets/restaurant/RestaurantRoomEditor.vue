<template>
  <div class="cfg room-editor">
    <div>
      <div class="callout blue cfg-intro">{{ $t("components.restaurant.room.intro") }}</div>
      <div v-if="changes.length" class="callout amber pending" role="status">
        <b>{{ $t("components.restaurant.room.pending", { n: changes.length }) }}</b>
        <ul><li v-for="(c, i) in changes" :key="i">{{ c }}</li></ul>
      </div>
      <div class="issues">
        <div v-if="allErrors.length" class="callout red" role="alert">
          <b>{{ $t("components.restaurant.room.errors", { n: allErrors.length }) }}</b>
          <ul><li v-for="(e, i) in allErrors" :key="i"><button class="linkish" @click="focusRef(e.ref)">{{ e.text }}</button></li></ul>
        </div>
        <div v-if="warnings.length" class="callout amber">
          <b>{{ $t("components.restaurant.room.warnings") }}</b>
          <ul><li v-for="(w, i) in warnings" :key="i">{{ w }}</li></ul>
        </div>
        <div v-if="saveMessage" class="callout" :class="saveMessage.ok ? 'blue' : 'red'" role="status">{{ saveMessage.text }}</div>
      </div>

      <section class="cfg-block card">
        <h2>{{ $t("components.restaurant.room.settings") }}</h2>
        <label class="field min-free">
          <span>{{ $t("components.restaurant.room.minFree") }}</span>
          <span class="tb-row"><input class="input" type="number" :min="limits.min" :max="limits.max" step="5" :value="minFree" data-ref="set-minfree"
                                      :class="{ invalid: minFreeError }" :aria-label="$t('components.restaurant.room.minFreeLabel')"
                                      @input="e => minFree = e.target.value === '' ? NaN : Number(e.target.value)"> {{ $t("components.restaurant.room.minutes") }}</span>
          <small>{{ $t("components.restaurant.room.minFreeHint", { n: rules.tableMinutes.upTo2, max: limits.max }) }}</small>
        </label>
      </section>

      <section class="cfg-block">
        <h2>{{ $t("components.restaurant.room.generator") }}</h2>
        <div class="gen">
          {{ $t("components.restaurant.room.genAdd") }}
          <input v-model.number="gen.n" type="number" min="1" max="40" :aria-label="$t('components.restaurant.room.genHowMany')">
          {{ $t("components.restaurant.room.genOf") }}
          <input v-model.number="gen.size" type="number" min="1" max="30" :aria-label="$t('components.restaurant.room.genSeats')">
          {{ $t("components.restaurant.room.genIn") }}
          <select v-model="gen.zone" :aria-label="$t('components.restaurant.room.genZone')">
            <option v-for="z in draft.zones" :key="z.id" :value="z.id">{{ z.name || $t("components.restaurant.room.unnamed") }}</option>
          </select>
          <button class="btn small" :disabled="!draft.zones.length" @click="generate">{{ $t("components.restaurant.room.genButton") }}</button>
          <span class="names">{{ genPreview }}</span>
        </div>
      </section>

      <section class="cfg-block">
        <h2>{{ $t("components.restaurant.room.zonesTables") }}</h2>
        <div v-for="(z, zi) in draft.zones" :key="z.id" class="zcard" :data-zone="z.id">
          <div class="zcard-head">
            <input v-model="z.name" class="zname" :data-ref="`z-${z.id}-name`" :class="{ invalid: hasError(`z-${z.id}-name`) }" :aria-label="$t('components.restaurant.room.zoneName')">
            <span class="pill">{{ $t("components.restaurant.room.zoneCount", { n: tablesOf(z.id).length, seats: seatsOf(z.id) }) }}</span>
            <span class="order">
              <button :disabled="zi === 0" :aria-label="$t('components.restaurant.room.up')" @click="moveZone(zi, -1)">↑</button>
              <button :disabled="zi === draft.zones.length - 1" :aria-label="$t('components.restaurant.room.down')" @click="moveZone(zi, 1)">↓</button>
              <button class="x-btn" :aria-label="$t('components.restaurant.room.zoneDelete', { name: z.name })" @click="deleteZone(z)">✕</button>
            </span>
          </div>
          <div class="zgrid">
            <label class="field"><span>{{ $t("components.restaurant.room.note") }}</span>
              <textarea v-model="z.note" :placeholder="$t('components.restaurant.room.notePlaceholder')"></textarea>
              <small>{{ $t("components.restaurant.room.noteHint") }}</small></label>
            <div class="field"><span>{{ $t("components.restaurant.room.closures") }}</span>
              <div v-for="(c, ci) in z.closures" :key="ci" class="closure">{{ shortDate(c.from) }} - {{ shortDate(c.to) }}
                <button class="x-btn" :aria-label="$t('components.restaurant.room.closureDelete')" @click="z.closures.splice(ci, 1)">✕</button></div>
              <small v-if="!z.closures.length">{{ $t("components.restaurant.room.alwaysOpen") }}</small>
              <div class="closure-add">
                <input v-model="closeForm(z.id).from" type="date" :aria-label="$t('components.restaurant.room.closedFrom')">
                <input v-model="closeForm(z.id).to" type="date" :aria-label="$t('components.restaurant.room.closedTo')">
                <button class="btn ghost small" @click="addClosure(z)">{{ $t("components.restaurant.room.closureAdd") }}</button>
              </div>
            </div>
          </div>
          <table class="tt"><thead><tr>
            <th>{{ $t("components.restaurant.room.tName") }}</th><th>{{ $t("components.restaurant.room.tMin") }}</th><th>{{ $t("components.restaurant.room.tMax") }}</th>
            <th>{{ $t("components.restaurant.room.tZone") }}</th><th>{{ $t("components.restaurant.room.tActive") }}</th><th></th></tr></thead>
            <tbody>
              <template v-for="t in tablesOf(z.id)" :key="t.id">
                <tr :class="{ inactive: !t.active }" :data-table="t.name">
                  <td><input v-model="t.name" type="text" :data-ref="`t-${t.id}-name`" :class="{ invalid: hasError(`t-${t.id}-name`) }" :aria-label="$t('components.restaurant.room.tNameOf')"></td>
                  <td><input v-model.number="t.min" type="number" min="1" :data-ref="`t-${t.id}-min`" :class="{ invalid: hasError(`t-${t.id}-min`) }" :aria-label="$t('components.restaurant.room.tMinOf', { name: t.name })"></td>
                  <td><input v-model.number="t.max" type="number" min="1" :data-ref="`t-${t.id}-max`" :class="{ invalid: hasError(`t-${t.id}-max`) }" :aria-label="$t('components.restaurant.room.tMaxOf', { name: t.name })"></td>
                  <td><select v-model="t.zone" :data-ref="`t-${t.id}-zone`" :class="{ invalid: hasError(`t-${t.id}-zone`) }" :aria-label="$t('components.restaurant.room.tZoneOf', { name: t.name })">
                    <option v-for="o in draft.zones" :key="o.id" :value="o.id">{{ o.name || $t("components.restaurant.room.unnamed") }}</option></select></td>
                  <td><input v-model="t.active" type="checkbox" :data-ref="`t-${t.id}-active`" :aria-label="$t('components.restaurant.room.tActiveOf', { name: t.name })"></td>
                  <td><button class="x-btn" :aria-label="$t('components.restaurant.room.tDelete', { name: t.name })" @click="deleteTable(t)">✕</button></td>
                </tr>
                <tr v-if="rowErrors(t).length"><td colspan="6" class="row-msg"><span v-for="(e, i) in rowErrors(t)" :key="i" class="err">{{ e }}<br></span></td></tr>
              </template>
            </tbody>
          </table>
          <button class="btn ghost small" @click="addTable(z.id)"><i class="pi pi-plus" aria-hidden="true"></i> {{ $t("components.restaurant.room.tAdd") }}</button>
        </div>
        <button class="btn ghost" @click="addZone"><i class="pi pi-plus" aria-hidden="true"></i> {{ $t("components.restaurant.room.zoneAdd") }}</button>
      </section>

      <section class="cfg-block card">
        <h2>{{ $t("components.restaurant.room.joins") }}</h2>
        <p class="muted">{{ $t("components.restaurant.room.joinsHint") }}</p>
        <div class="join-list">
          <div v-for="(j, ji) in draft.joins" :key="ji" class="jrow" :data-join="label(j.tables)">
            <b>{{ label(j.tables) }}</b><span class="muted">{{ zoneNameOf(j.tables[0]) }}</span>
            {{ $t("components.restaurant.room.from") }} <input v-model.number="j.min" type="number" min="1" :data-ref="`j-${ji}`" :aria-label="$t('components.restaurant.room.jMin')">
            {{ $t("components.restaurant.room.to") }} <input v-model.number="j.max" type="number" min="1" :aria-label="$t('components.restaurant.room.jMax')"> {{ $t("components.restaurant.room.people") }}
            <button class="btn ghost small" :aria-expanded="joinEdit === ji" @click="joinEdit = joinEdit === ji ? null : ji">{{ $t(joinEdit === ji ? "components.restaurant.room.jDone" : "components.restaurant.room.jChange") }}</button>
            <button class="x-btn" :aria-label="$t('components.restaurant.room.jDelete')" @click="draft.joins.splice(ji, 1)">✕</button>
            <div v-if="joinEdit === ji" class="pick pick-wide">
              <template v-for="z in draft.zones" :key="z.id">
                <template v-if="tablesOf(z.id).length">
                  <span class="zl">{{ z.name }}</span>
                  <label v-for="t in tablesOf(z.id)" :key="t.id" :class="{ on: j.tables.includes(t.id) }">
                    <input type="checkbox" :checked="j.tables.includes(t.id)" @change="e => toggleIn(j.tables, t.id, e.target.checked)"> {{ t.name }}</label>
                </template>
              </template>
            </div>
          </div>
          <p v-if="!draft.joins.length" class="muted">{{ $t("components.restaurant.room.noJoins") }}</p>
        </div>
        <h4>{{ $t("components.restaurant.room.newJoin") }}</h4>
        <div class="pick">
          <template v-for="z in draft.zones" :key="z.id">
            <template v-if="tablesOf(z.id).length">
              <span class="zl">{{ z.name }}</span>
              <label v-for="t in tablesOf(z.id)" :key="t.id" :class="{ on: joinPick.includes(t.id) }">
                <input type="checkbox" :checked="joinPick.includes(t.id)" :aria-label="t.name" @change="e => toggleIn(joinPick, t.id, e.target.checked)"> {{ t.name }}</label>
            </template>
          </template>
        </div>
        <div class="join-builder">
          <span :class="joinBuilder.cls">{{ joinBuilder.text }}</span>
          <button class="btn small" :disabled="!joinBuilder.ok" @click="createJoin">{{ $t("components.restaurant.room.jCreate") }}</button>
        </div>
      </section>
    </div>

    <aside class="preview card">
      <h2>{{ $t("components.restaurant.room.preview") }}</h2>
      <p class="muted">{{ $t("components.restaurant.room.previewHint") }}</p>
      <div class="tb-row">
        <div class="preview-day" role="group" :aria-label="$t('components.restaurant.room.previewDay')">
          <RestaurantDayNav :date="preview.date" :today="today" compact @go-day="d => setPreview({ date: d })" />
        </div>
        <div class="seg" role="group" :aria-label="$t('components.restaurant.day.serviceLabel')">
          <button v-for="s in ['lunch', 'dinner']" :key="s" :aria-pressed="preview.service === s" @click="setPreview({ service: s })">{{ $t(`components.restaurant.service.${s}`) }}</button>
        </div>
      </div>
      <p><b>{{ activeTables.length }}</b> {{ $t("components.restaurant.room.activeTables") }} · <b>{{ activeTables.reduce((a, t) => a + t.max, 0) }}</b> {{ $t("components.restaurant.room.seatsWord") }}</p>
      <p v-if="preview.loading" class="muted">{{ $t("components.restaurant.toolbar.asking") }}</p>
      <p v-else-if="preview.error" class="muted">{{ $t("components.restaurant.room.previewUnavailable") }}</p>
      <template v-else-if="previewService">
        <p v-if="!previewService.open" class="muted">{{ $t("components.restaurant.day.closed") }}</p>
        <template v-else>
          <p>{{ $t("components.restaurant.room.largest", { n: previewService.largestParty }) }}</p>
          <table><thead><tr><th>{{ $t("components.restaurant.room.people") }}</th><th>{{ $t("components.restaurant.room.offers") }}</th></tr></thead>
            <tbody><tr v-for="n in Object.keys(previewService.bookable || {})" :key="n"><td><b>{{ n }}</b></td>
              <td>{{ (previewService.bookable[n] || []).join(", ") || $t("components.restaurant.room.notBookable") }}</td></tr></tbody></table>
        </template>
      </template>
      <div class="say"><small>{{ $t("components.restaurant.room.zonesSaid", { zones: openZones || $t("components.restaurant.room.none") }) }}</small></div>
    </aside>

    <div class="savebar">
      <span :class="totalChanges ? 'warn' : 'muted'">{{ totalChanges ? $t("components.restaurant.room.unsaved", { n: totalChanges }) : $t("components.restaurant.room.noChanges") }}</span>
      <span class="spacer"></span>
      <button class="btn ghost" :disabled="!totalChanges || saving" @click="askDiscard">{{ $t("components.restaurant.room.discard") }}</button>
      <button class="btn save-room" :disabled="!totalChanges || allErrors.length > 0 || saving" @click="save">
        {{ allErrors.length ? $t("components.restaurant.room.saveWithErrors", { n: allErrors.length }) : $t("components.restaurant.room.save") }}</button>
    </div>
  </div>
</template>

<script>
import { useConfirm } from "primevue/useconfirm";
import RestaurantApi from "@/utils/Restaurant";
import {
  clone, diffLayout, draftProblems, addTables, genNames, minFor, newTableId, zoneIdFor, joinRange, seatLabel, tableById,
  minFreeLimits, addDays, fmt
} from "@/utils/RestaurantModel";
import { shortDate } from "@/components/widgets/restaurant/format";
import RestaurantDayNav from "@/components/widgets/restaurant/RestaurantDayNav.vue";
import { layoutMessage } from "@/components/widgets/restaurant/layoutMessages";

/**
 * "Sala e tavoli": the whole room in one form, saved as one layout at the revision read. Nothing reaches the
 * assistant until "Salva modifiche"; until then the summary lists every pending change and "Annulla
 * modifiche" throws them away. The minimum free time is edited here too, but it belongs to the skill's
 * configuration: it is written there, with that configuration's own revision, by a second request.
 *
 * The form says early what it can (an empty name, a join across zones); the server judges the layout on
 * the preview and on the save, and only it knows which tables still have bookings: its refusals are said
 * per field, naming the bookings the page has read on that table.
 */
export default {
  components: { RestaurantDayNav },
  setup() {
    return { confirm: useConfirm() };
  },
  props: {
    user: { type: Object, required: true },
    businessId: { type: String, required: true },
    layout: { type: Object, required: true },
    instance: { type: Object, required: true },
    rules: { type: Object, required: true },
    today: { type: String, required: true },
    bookingsOn: { type: Function, required: true },
  },
  emits: ["saved", "instance-saved", "toast"],
  data() {
    return {
      draft: clone(this.layout),
      minFree: this.rules.minFreeMinutes,
      gen: { n: 4, size: 2, zone: this.layout.zones.length ? this.layout.zones[0].id : null },
      closeForms: {},
      joinPick: [],
      joinEdit: null,
      serverProblems: [],
      saveMessage: null,
      saving: false,
      preview: { date: addDays(this.today, 1), service: "dinner", loading: false, error: false, data: null },
    };
  },
  computed: {
    limits() {
      return minFreeLimits(this.rules);
    },
    minFreeError() {
      const n = this.minFree;
      return !(Number.isInteger(n) && n >= this.limits.min && n <= this.limits.max);
    },
    minFreeChanged() {
      return this.minFree !== this.rules.minFreeMinutes;
    },
    layoutChanges() {
      return diffLayout(this.layout, this.draft);
    },
    changes() {
      const out = this.layoutChanges.map(c => this.$t(`components.restaurant.diff.${c.code}`, c.args));
      if (this.minFreeChanged) out.push(this.$t("components.restaurant.diff.minFree", { from: this.rules.minFreeMinutes, to: this.minFree }));
      return out;
    },
    totalChanges() {
      return this.changes.length;
    },
    clientErrors() {
      const out = draftProblems(this.draft).map(p => ({ ref: p.ref, text: this.$t(`components.restaurant.check.${p.code}`, p.args) }));
      this.draft.tables.forEach(t => {
        if (t.max > 30) out.push({ ref: `t-${t.id}-max`, text: this.$t("components.restaurant.check.tableTooBig", { name: t.name }) });
      });
      if (this.minFreeError) out.push({ ref: "set-minfree", text: this.$t("components.restaurant.check.minFree", this.limits) });
      return out;
    },
    /** What the server's preview of the draft refuses: the problems the save would answer, said before it. */
    previewProblems() {
      const ps = (this.preview.data && this.preview.data.problems) || [];
      return ps.map(p => ({ ref: this.refOf(p.path), text: this.problemText(p) }));
    },
    allErrors() {
      return this.clientErrors.concat(this.serverProblems.length ? this.serverProblems : this.previewProblems);
    },
    warnings() {
      const ws = (this.preview.data && this.preview.data.warnings) || [];
      return ws.map(w => this.problemText(w));
    },
    activeTables() {
      return this.draft.tables.filter(t => t.active);
    },
    openZones() {
      return this.draft.zones.filter(z => this.draft.tables.some(t => t.zone === z.id && t.active))
        .map(z => z.note ? `${z.name} (${z.note})` : z.name).join(", ");
    },
    previewService() {
      const ss = (this.preview.data && this.preview.data.services) || [];
      return ss.find(s => s.service === this.preview.service) || null;
    },
    genPreview() {
      if (!this.gen.zone) return "";
      const n = Math.max(0, Math.min(40, this.gen.n | 0));
      const names = genNames(this.draft, this.gen.zone, n);
      if (!names.length) return "";
      const shown = names.length > 6 ? `${names.slice(0, 3).join(", ")} … ${names[names.length - 1]}` : names.join(", ");
      return this.$t("components.restaurant.room.genNames", { names: shown, min: minFor(this.gen.size), max: this.gen.size });
    },
    joinBuilder() {
      const ts = this.joinPick.map(id => tableById(this.draft, id)).filter(Boolean);
      if (ts.length < 2) return { cls: "muted", text: this.$t("components.restaurant.room.jPickTwo"), ok: false };
      if (new Set(ts.map(t => t.zone)).size > 1) return { cls: "err", text: this.$t("components.restaurant.check.joinZones", { label: ts.map(t => t.name).join("+") }), ok: false };
      const r = joinRange(ts);
      return { cls: "ok", text: this.$t("components.restaurant.room.jWillBe", { label: ts.map(t => t.name).join("+"), min: r.min, max: r.max }), ok: true };
    },
  },
  watch: {
    layout(next) {
      this.draft = clone(next);
      this.serverProblems = [];
    },
    "rules.minFreeMinutes"(n) {
      this.minFree = n;
    },
    draft: {
      deep: true,
      handler() {
        this.serverProblems = [];
        this.saveMessage = null;
        this.schedulePreview();
      },
    },
  },
  mounted() {
    this.loadPreview();
  },
  methods: {
    fmt,
    shortDate(key) {
      return key ? shortDate(key, this.$i18n.locale) : "";
    },
    tablesOf(zoneId) {
      return this.draft.tables.filter(t => t.zone === zoneId);
    },
    seatsOf(zoneId) {
      return this.tablesOf(zoneId).filter(t => t.active).reduce((a, t) => a + (Number(t.max) || 0), 0);
    },
    label(ids) {
      return seatLabel(this.draft, ids);
    },
    zoneNameOf(tableId) {
      const t = tableById(this.draft, tableId);
      const z = t ? this.draft.zones.find(x => x.id === t.zone) : null;
      return z ? z.name : "";
    },
    hasError(ref) {
      return this.allErrors.some(e => e.ref === ref);
    },
    rowErrors(t) {
      return this.allErrors.filter(e => e.ref && e.ref.startsWith(`t-${t.id}-`)).map(e => e.text);
    },
    focusRef(ref) {
      const el = ref && this.$el.querySelector(`[data-ref="${ref}"]`);
      if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.focus(); }
    },
    closeForm(zoneId) {
      if (!this.closeForms[zoneId]) this.closeForms[zoneId] = { from: "", to: "" };
      return this.closeForms[zoneId];
    },
    addClosure(z) {
      const f = this.closeForm(z.id);
      if (!f.from || !f.to) {
        this.$emit("toast", this.$t("components.restaurant.room.closureDates"), null, true);
        return;
      }
      z.closures.push({ from: f.from, to: f.to });
      this.closeForms[z.id] = { from: "", to: "" };
    },
    toggleIn(list, id, on) {
      const i = list.indexOf(id);
      if (on && i < 0) list.push(id);
      if (!on && i >= 0) list.splice(i, 1);
    },
    moveZone(i, n) {
      const zs = this.draft.zones;
      [zs[i], zs[i + n]] = [zs[i + n], zs[i]];
      zs.forEach((z, k) => { z.order = k; });
    },
    addZone() {
      const name = this.$t("components.restaurant.room.newZone");
      const id = zoneIdFor(name, this.draft.zones.map(z => z.id));
      this.draft.zones.push({ id, name, order: this.draft.zones.length, note: "", closures: [] });
      this.gen.zone = id;
    },
    /** Names the bookings the page has read on a table, from today on. */
    namesOn(tableId) {
      const found = this.bookingsOn(tableId);
      if (!found.length) return "";
      const shown = found.slice(0, 3).map(({ date, b }) => `${b.name} (${this.shortDate(date)} ${fmt(b.start)}, ${b.party})`).join(", ");
      return found.length > 3 ? this.$t("components.restaurant.room.andOthers", { names: shown, n: found.length - 3 }) : shown;
    },
    deleteZone(z) {
      const held = this.layout.tables.filter(t => t.zone === z.id && this.bookingsOn(t.id).length);
      if (held.length) {
        this.$emit("toast", this.$t("components.restaurant.room.zoneHeld", { name: z.name, who: held.map(t => this.namesOn(t.id)).join("; ") }), null, true);
        return;
      }
      const n = this.tablesOf(z.id).length;
      this.confirm.require({
        header: this.$t("components.restaurant.room.zoneDeleteTitle", { name: z.name }),
        message: this.$t(n ? "components.restaurant.room.zoneDeleteText" : "components.restaurant.room.zoneDeleteEmpty", { n }),
        acceptLabel: this.$t("components.restaurant.room.delete"),
        rejectLabel: this.$t("components.restaurant.confirm.keep"),
        acceptClass: "p-button-danger",
        defaultFocus: "reject",
        accept: () => {
          const gone = new Set(this.tablesOf(z.id).map(t => t.id));
          this.draft.zones = this.draft.zones.filter(x => x.id !== z.id);
          this.draft.tables = this.draft.tables.filter(t => !gone.has(t.id));
          this.draft.joins = this.draft.joins.filter(j => !j.tables.some(id => gone.has(id)));
        },
      });
    },
    addTable(zoneId) {
      const [name] = genNames(this.draft, zoneId, 1);
      this.draft.tables.push({ id: newTableId(this.draft), zone: zoneId, name, min: 1, max: 2, active: true });
    },
    deleteTable(t) {
      if (t.id > 0 && this.bookingsOn(t.id).length) {
        this.$emit("toast", this.$t("components.restaurant.room.tableHeld", { name: t.name, who: this.namesOn(t.id) }), null, true);
        return;
      }
      const lost = this.draft.joins.filter(j => j.tables.includes(t.id)).length;
      this.draft.tables = this.draft.tables.filter(x => x.id !== t.id);
      this.draft.joins = this.draft.joins.filter(j => !j.tables.includes(t.id));
      this.$emit("toast", this.$t(lost ? "components.restaurant.room.tableRemovedJoins" : "components.restaurant.room.tableRemoved", { name: t.name, n: lost }));
    },
    generate() {
      if (!this.gen.zone) return;
      const n = Math.max(1, Math.min(40, this.gen.n | 0));
      const size = Math.max(1, Math.min(30, this.gen.size | 0));
      const names = addTables(this.draft, this.gen.zone, n, size);
      const z = this.draft.zones.find(x => x.id === this.gen.zone);
      this.$emit("toast", this.$t("components.restaurant.room.generated", { first: names[0], last: names[names.length - 1], zone: z ? z.name : "" }));
    },
    createJoin() {
      const ts = this.joinPick.map(id => tableById(this.draft, id));
      this.draft.joins.push(Object.assign({ tables: this.joinPick.slice() }, joinRange(ts)));
      this.joinPick = [];
    },
    askDiscard() {
      this.confirm.require({
        header: this.$t("components.restaurant.room.discardTitle", { n: this.totalChanges }),
        message: this.$t("components.restaurant.room.discardText"),
        acceptLabel: this.$t("components.restaurant.room.discard"),
        rejectLabel: this.$t("components.restaurant.confirm.keep"),
        acceptClass: "p-button-danger",
        defaultFocus: "reject",
        accept: () => {
          this.draft = clone(this.layout);
          this.minFree = this.rules.minFreeMinutes;
          this.joinPick = [];
          this.joinEdit = null;
          this.$emit("toast", this.$t("components.restaurant.room.discarded"));
        },
      });
    },

    // ------------------------------------------------------------ the server's judgement

    /** A refusal or a warning in the owner's words, by its code; a table that still has bookings names them. */
    problemText(p) {
      return layoutMessage(p, { t: (k, a) => this.$t(k, a || {}), te: k => this.$te(k), whoOn: table => {
        const found = this.layout.tables.find(x => x.name === table || x.id === table);
        return found ? this.namesOn(found.id) : "";
      } });
    },
    /** The field a server problem is about, from its path in the layout the save sent. */
    refOf(path) {
      // a save's paths start with /layout, the preview's are the document's own
      const m = /^(?:\/layout)?\/(zones|tables|joins)\/(\d+)\/?(\w+)?/.exec(path || "");
      if (!m) return "";
      const i = Number(m[2]);
      if (m[1] === "zones") return this.draft.zones[i] ? `z-${this.draft.zones[i].id}-name` : "";
      if (m[1] === "tables") return this.draft.tables[i] ? `t-${this.draft.tables[i].id}-${m[3] === "id" ? "name" : m[3] || "name"}` : "";
      return `j-${i}`;
    },
    schedulePreview() {
      clearTimeout(this.previewTimer);
      this.previewTimer = setTimeout(() => this.loadPreview(), 600);
    },
    /** Another day or service of the preview. A day changes the server's answer, so it is asked once the owner
     *  stops clicking through days (the same wait as an edit); a service is in the answer already. */
    setPreview(change) {
      Object.assign(this.preview, change);
      if (change.date) this.schedulePreview();
    },
    async loadPreview() {
      if (draftProblems(this.draft).length) return;
      const asked = clone(this.draft);
      this.preview.loading = true;
      this.preview.error = false;
      try {
        const data = await RestaurantApi.previewLayout(this.user, this.businessId, this.preview.date, asked);
        this.preview.data = data;
      } catch (e) {
        console.warn("Restaurant layout preview not answered:", e.restaurant ? e.restaurant.code || e.restaurant.status : e);
        this.preview.error = true;
        this.preview.data = null;
      } finally {
        this.preview.loading = false;
      }
    },
    async save() {
      if (this.allErrors.length || this.saving) return;
      this.saving = true;
      this.saveMessage = null;
      const layoutCount = this.layoutChanges.length;
      try {
        if (layoutCount) {
          try {
            await RestaurantApi.saveLayout(this.user, this.businessId, this.layout.revision, this.draft);
          } catch (e) {
            this.refused(e, "layout");
            return;
          }
        }
        if (this.minFreeChanged) {
          try {
            await RestaurantApi.saveInstance(this.user, this.businessId, this.instance, { minFreeMinutes: String(this.minFree) });
          } catch (e) {
            this.refused(e, "minFree", layoutCount > 0);
            if (layoutCount) this.$emit("saved");
            return;
          }
          this.$emit("instance-saved");
        }
        if (layoutCount) this.$emit("saved");
        const zones = this.draft.zones.filter(z => this.draft.tables.some(t => t.zone === z.id && t.active)).map(z => z.name).join(", ");
        this.$emit("toast", this.$t("components.restaurant.room.savedToast", { n: this.totalChanges, zones }));
      } finally {
        this.saving = false;
      }
    },
    refused(e, what, partly = false) {
      const r = e.restaurant || {};
      const diagnostics = (r.body && Array.isArray(r.body.diagnostics)) ? r.body.diagnostics : [];
      if (what === "layout" && r.status === 422 && diagnostics.length) {
        this.serverProblems = diagnostics.map(d => ({ ref: this.refOf(d.path), text: this.problemText(d) }));
        return;
      }
      let key = "components.restaurant.answer.error";
      if (r.status === 409 && r.code === "stale") key = "components.restaurant.room.stale";
      else if (r.status === 409 && what === "minFree") key = "components.restaurant.room.configChanged";
      else if (r.status === 409 && r.code === "not_configured") key = "components.restaurant.room.needsHours";
      else if (r.status === 422 && what === "minFree") key = "components.restaurant.room.minFreeRefused";
      else if (r.code) key = `components.restaurant.answer.${r.code}`;
      this.saveMessage = { ok: false, text: (partly ? this.$t("components.restaurant.room.layoutSavedOnly") + " " : "") +
        (this.$te(key) ? this.$t(key) : this.$t("components.restaurant.answer.error")) };
      if (r.code === "stale") this.$emit("saved");
      if (what === "minFree" && r.status === 409) this.$emit("instance-saved");
    },
  },
};
</script>
