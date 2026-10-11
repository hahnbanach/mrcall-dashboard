<template>
  <section class="day" :aria-label="$t('components.restaurant.day.label')">
    <div class="day-head">
      <div class="day-nav">
        <button class="icon-btn" :aria-label="$t('components.restaurant.day.prev')" @click="$emit('go-day', shift(-1))"><i class="pi pi-chevron-left" aria-hidden="true"></i></button>
        <h2 class="day-title">{{ longDate(date) }}</h2>
        <button class="icon-btn" :aria-label="$t('components.restaurant.day.next')" @click="$emit('go-day', shift(1))"><i class="pi pi-chevron-right" aria-hidden="true"></i></button>
        <button class="btn ghost small" :disabled="date === today" @click="$emit('go-day', today)">{{ $t("components.restaurant.day.today") }}</button>
        <input class="date-input" type="date" :value="date" :aria-label="$t('components.restaurant.day.pick')" @change="e => e.target.value && $emit('go-day', e.target.value)">
      </div>
      <div class="svc-tabs" role="group" :aria-label="$t('components.restaurant.day.serviceLabel')">
        <button v-for="s in ['lunch', 'dinner']" :key="s" class="svc-tab" :aria-pressed="service === s" @click="$emit('set-service', s)">
          <b>{{ $t(`components.restaurant.service.${s}`) }}</b>
          <small>{{ isClosed(s) ? $t("components.restaurant.day.closed") : $t("components.restaurant.covers", { n: coversOf(s) }) }}</small>
        </button>
      </div>
      <span class="spacer"></span>
      <button v-if="!closed" class="btn new-booking" @click="$emit('new-booking')"><i class="pi pi-plus" aria-hidden="true"></i> {{ $t("components.restaurant.day.newBooking") }}</button>
    </div>

    <div v-if="closed" class="card closed-day">
      <h3>{{ $t("components.restaurant.day.closedTitle", { service: $t(`components.restaurant.service.${service}`) }) }}</h3>
      <p class="muted">{{ $t("components.restaurant.day.closedText") }}</p>
    </div>

    <template v-else>
      <div class="summary">
        <span class="big-num"><b>{{ coversOf(service) }}</b> {{ $t(date === today ? "components.restaurant.day.coversTonight" : "components.restaurant.day.coversBooked") }}
          <small>{{ $t("components.restaurant.day.capacity", { n: capacity }) }}</small></span>
        <span class="big-num free-count"><b :class="{ err: !freeNow }">{{ freeNow }}</b> {{ $t("components.restaurant.day.freeTables", { n: freeNow, total: usable.length, time: fmt(time) }) }}</span>
        <span class="know"><span class="lbl">{{ $t("components.restaurant.know.label") }}</span>
          <button v-for="k in knowKeys" :key="k" class="pill know-chip" :class="KNOW_CLASS[k]" :aria-pressed="know === k" :aria-expanded="know === k"
                  @click="know = know === k ? null : k">{{ $t(`components.restaurant.know.${k}`, { n: knowCounts[k].length }) }}</button>
          <span v-if="!knowKeys.length" class="muted">{{ $t("components.restaurant.know.nothing") }}</span>
        </span>
      </div>
      <div v-if="know && knowCounts[know].length" class="know-pop" role="status">
        <b>{{ $t(`components.restaurant.know.title.${know}`) }}:</b>
        <template v-for="(b, i) in knowCounts[know]" :key="b.id">
          <span v-if="i" class="sep">;</span>
          <button class="linkish" @click="$emit('open', b.id)">{{ b.name }}</button>
          <small> {{ fmt(b.start) }} · {{ seatsOf(b) }} · {{ knowDetail(b) }}</small>
        </template>
        <button class="x-btn" :aria-label="$t('components.restaurant.close')" @click="know = null">✕</button>
      </div>

      <div class="toolbar card">
        <div class="tb tb-time">
          <span class="tb-lbl">{{ $t("components.restaurant.toolbar.time") }} <small>{{ $t("components.restaurant.toolbar.minFree", { n: minFree }) }}</small></span>
          <div ref="chips" class="tchips">
            <button v-for="c in chips" :key="c.t" class="tchip" :class="{ none: !c.free }" :aria-pressed="c.t === time" :data-time="fmt(c.t)"
                    @click="$emit('set-time', c.t)"><b>{{ fmt(c.t) }}</b><small>{{ $t("components.restaurant.toolbar.free", { n: c.free }) }}</small></button>
          </div>
        </div>
        <div class="tb tb-find">
          <span class="tb-lbl">{{ $t("components.restaurant.toolbar.find") }}</span>
          <div class="tb-row">
            <span class="stepper">
              <button :aria-label="$t('components.restaurant.toolbar.less')" @click="$emit('find', Math.max(0, find - 1))">−</button>
              <output aria-live="polite">{{ find || "–" }}</output>
              <button :aria-label="$t('components.restaurant.toolbar.more')" @click="$emit('find', Math.min(40, find + 1))">+</button>
            </span>
            <span>{{ $t("components.restaurant.toolbar.people") }}</span>
            <button v-if="find" class="btn ghost small" @click="$emit('find', 0)">{{ $t("components.restaurant.toolbar.clear") }}</button>
          </div>
          <div class="find-line" role="status">
            <span v-if="!find" class="muted">{{ $t("components.restaurant.toolbar.findHint", { time: fmt(time) }) }}</span>
            <span v-else-if="!findAnswer || findAnswer.loading" class="muted">{{ $t("components.restaurant.toolbar.asking") }}</span>
            <span v-else-if="findAnswer.error" class="err">{{ $t("components.restaurant.answer.error") }}</span>
            <template v-else-if="findAnswer.fits.length">
              <b>{{ $t("components.restaurant.toolbar.forAt", { n: find, time: fmt(time) }) }}</b>
              <button v-for="(f, i) in findAnswer.fits.slice(0, 4)" :key="f.ids.join()" class="chip" :title="zoneName(f.zone)"
                      @click="$emit('fit-book', i)">{{ f.label }}<template v-if="i === 0"> ({{ $t("components.restaurant.toolbar.best") }})</template><template v-if="f.moves.length"> · {{ $t("components.restaurant.toolbar.moves", { n: f.moves.length }, f.moves.length) }}</template></button>
              <small v-if="findAnswer.fits.length > 4">{{ $t("components.restaurant.toolbar.andMore", { n: findAnswer.fits.length - 4 }) }}</small>
            </template>
            <template v-else>
              <b>{{ $t("components.restaurant.toolbar.noneAt", { n: find, time: fmt(time) }) }}</b>
              <span v-if="findAnswer.refusal && findAnswer.refusal !== 'full'" class="refusal-why">{{ $t(refusalKey(findAnswer.refusal)) }}</span>
              <template v-if="findAnswer.later.length">
                {{ $t("components.restaurant.toolbar.later") }}
                <button v-for="t in findAnswer.later.slice(0, 4)" :key="t" class="chip" @click="$emit('set-time', t)">{{ fmt(t) }}</button>
              </template>
              <span v-else>{{ $t("components.restaurant.toolbar.noneLater") }}</span>
            </template>
          </div>
        </div>
      </div>

      <div v-if="movingBooking" class="move-banner" role="status">
        <span>{{ $t("components.restaurant.move.banner", { name: movingBooking.name, party: movingBooking.party, time: fmt(movingBooking.start) }) }}</span>
        <button class="btn ghost small" @click="$emit('move-cancel')">{{ $t("components.restaurant.move.cancel") }}</button>
      </div>

      <div class="mode-row">
        <div class="seg" role="group" :aria-label="$t('components.restaurant.day.view')">
          <button :aria-pressed="mode === 'floor'" @click="mode = 'floor'">{{ $t("components.restaurant.day.floor") }}</button>
          <button :aria-pressed="mode === 'timeline'" @click="mode = 'timeline'">{{ $t("components.restaurant.day.timeline") }}</button>
        </div>
        <span class="hint">{{ mode === 'floor' ? $t("components.restaurant.day.floorHint", { time: fmt(time), n: minFree }) : $t("components.restaurant.day.timelineHint") }}</span>
      </div>

      <div class="day-body" :class="{ knowing: !!know }">
        <div>
          <!-- the floor: tables by zone at the chosen time -->
          <template v-if="mode === 'floor'">
            <section v-for="z in zones" :key="z.zone.id" class="zone" :data-zone="z.zone.id">
              <div class="zone-head">
                <h3>{{ z.zone.name }}</h3>
                <span v-if="z.open" class="pill" :class="z.freeN ? 'green' : 'red'">{{ $t("components.restaurant.floor.zoneFree", { n: z.freeN, total: z.tables.length }) }}</span>
                <span v-if="z.zone.note" class="note">{{ z.zone.note }}</span>
              </div>
              <div v-if="!z.open" class="zone-closed">{{ $t("components.restaurant.floor.zoneClosed") }}</div>
              <div v-else class="tiles">
                <template v-for="tile in z.tiles" :key="tile.key">
                  <button v-if="tile.busy" class="tile" :class="tile.cls"  :data-table="tile.names"
                          :draggable="tile.b.state !== 'block'" :aria-label="tile.aria"
                          @click="tile.b.state === 'block' ? null : $emit('open', tile.b.id)" @dragstart="e => dragStart(e, tile.b)">
                    <span class="tname">{{ tile.names }}<span v-if="tile.members.length > 1" class="join-tag">{{ $t("components.restaurant.floor.joined") }}</span></span>
                    <span class="seats">{{ tile.seats }}</span>
                    <span class="corner"><i v-if="tile.b.allergies" class="pi pi-exclamation-triangle" :aria-label="$t('components.restaurant.allergies')"></i><i v-if="tile.b.pinned" class="pi pi-thumbtack" :aria-label="$t('components.restaurant.pinnedMark')"></i></span>
                    <span class="who">{{ tile.who }}</span>
                    <span class="line">{{ fmt(tile.b.start) }}-{{ fmt(tile.b.end) }}<template v-if="tile.b.source === 'walk_in'"> · {{ $t("components.restaurant.walkInName") }}</template></span>
                    <span v-for="h in tile.hits" :key="h.id" class="hit-tag">{{ h.name }} {{ fmt(h.start) }}</span>
                    <span class="foot">{{ tile.foot }}</span>
                  </button>
                  <button v-else class="tile" :class="tile.cls" :data-table="tile.t.name" :aria-label="tile.aria"
                          @click="$emit('tile-free', tile.t.id)" @dragover.prevent="e => e.currentTarget.classList.add('drop-over')"
                          @dragleave="e => e.currentTarget.classList.remove('drop-over')" @drop.prevent="e => dropped(e, tile.t.id)">
                    <span class="tname">{{ tile.t.name }}</span>
                    <span class="seats">{{ sizeLabel(tile.t) }}</span>
                    <span v-if="tile.with" class="with">{{ $t("components.restaurant.floor.with", { tables: tile.with }) }}</span>
                    <span v-if="tile.left" class="line muted">{{ $t("components.restaurant.floor.leftAt", { name: tile.left.name, time: fmt(tile.left.end) }) }}</span>
                    <span v-if="tile.next" class="line">{{ tile.nextLine }}</span>
                    <span v-if="tile.held" class="line warn">{{ $t("components.restaurant.floor.held") }}</span>
                    <span v-for="h in tile.hits" :key="h.id" class="hit-tag">{{ h.name }} {{ fmt(h.start) }}</span>
                    <span class="foot">{{ tile.foot }}</span>
                    <small v-if="tile.sub" class="line">{{ tile.sub }}</small>
                    <span v-if="tile.best" class="best">{{ $t("components.restaurant.toolbar.best") }}</span>
                  </button>
                </template>
              </div>
            </section>
          </template>

          <!-- the timeline: one row per table -->
          <div v-else class="tl-wrap">
            <div class="tl" :style="{ '--slots': slots }">
              <div class="tl-row tl-head"><div class="tl-label"></div>
                <div class="tl-track" :title="$t('components.restaurant.timeline.setTime')" @click="e => $emit('set-time', minuteAt(e, true))">
                  <span v-for="m in ticks" :key="m" class="tl-tick" :style="{ left: pct(m) }">{{ fmt(m) }}</span>
                  <span class="tl-now" :style="{ left: pct(time) }"></span>
                </div>
              </div>
              <template v-for="z in zones" :key="z.zone.id">
                <div class="tl-zone">{{ z.zone.name }}<template v-if="!z.open"> · {{ $t("components.restaurant.timeline.zoneClosed") }}</template></div>
                <template v-if="z.open">
                  <div v-for="t in z.tables" :key="t.id" class="tl-row" :data-table="t.name">
                    <div class="tl-label">{{ t.name }}<small>{{ t.min }}-{{ t.max }}</small></div>
                    <div class="tl-track" @click.self="e => $emit('timeline-new', { tableId: t.id, minute: minuteAt(e, false) })">
                      <button v-for="b in barsOf(t.id)" :key="b.id" class="tl-bar" :class="[barClass(b), { hit: isHit(b) }]"
                              :style="{ left: pct(b.start), width: `calc(${pct(Math.min(b.end, win.close))} - ${pct(b.start)})` }"
                              :title="`${b.name || blockName}, ${$t('components.restaurant.people', { n: b.party })}, ${fmt(b.start)}-${fmt(b.end)}`"
                              @click="b.state === 'block' ? null : $emit('open', b.id)">
                        <i v-if="b.pinned" class="pi pi-thumbtack" aria-hidden="true"></i>
                        <span v-if="b.tables.length > 1" class="join-tag">{{ seatsOf(b) }}</span>{{ b.state === 'block' ? blockName : b.name }} · {{ b.party }}
                      </button>
                      <span class="tl-now" :style="{ left: pct(time) }"></span>
                    </div>
                  </div>
                </template>
              </template>
              <template v-if="orphans.length">
                <div class="tl-zone">{{ $t("components.restaurant.noTable") }}</div>
                <div v-for="b in orphans" :key="b.id" class="tl-row"><div class="tl-label">?</div>
                  <div class="tl-track"><button class="tl-bar arrived" :style="{ left: pct(b.start), width: `calc(${pct(Math.min(b.end, win.close))} - ${pct(b.start)})` }"
                                                @click="$emit('open', b.id)">{{ b.name }} · {{ b.party }}</button></div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- the bookings of the service -->
        <aside class="list" :class="{ knowing: !!know }" :aria-label="$t('components.restaurant.list.label')">
          <h3>{{ $t("components.restaurant.list.title", { service: $t(`components.restaurant.service.${service}`), n: active.length }) }}</h3>
          <div v-if="requests.length" class="requests">
            <h4>{{ $t("components.restaurant.list.requests", { n: requests.length }) }}</h4>
            <div v-for="r in requests" :key="r.id" class="req">
              <b>{{ fmt(r.start) }} · {{ r.name }} · {{ $t("components.restaurant.people", { n: r.party }) }}</b>
              <br><span v-if="r.requestReason">{{ $t(`components.restaurant.reason.${r.requestReason}`) }}</span><span v-if="r.notes"> · {{ r.notes }}</span>
              <div class="acts">
                <button class="btn small" :disabled="busy" @click="$emit('accept', r)">{{ $t("components.restaurant.list.accept") }}</button>
                <button class="btn ghost small" :disabled="busy" @click="$emit('decline', r)">{{ $t("components.restaurant.list.decline") }}</button>
                <button v-if="hasCalls(r)" class="btn ghost small" @click="$emit('call', r)">{{ $t("components.restaurant.readCall") }}</button>
              </div>
            </div>
          </div>
          <div v-if="orphans.length" class="unseated"><b>{{ $t("components.restaurant.list.noTable", { n: orphans.length }) }}</b>: {{ $t("components.restaurant.list.noTableHint") }}</div>
          <div class="filters" role="group" :aria-label="$t('components.restaurant.list.filter')">
            <button v-for="f in FILTERS" :key="f" :aria-pressed="filter === f" @click="filter = f">{{ $t(`components.restaurant.list.filters.${f}`) }} {{ groups[f].length }}</button>
          </div>
          <div v-for="b in groups[filter]" :key="b.id" class="brow" :class="rowClass(b)" role="button" tabindex="0" :data-booking="b.id"
               @click="$emit('open', b.id)" @keydown.enter.prevent="$emit('open', b.id)" @keydown.space.prevent="$emit('open', b.id)">
            <span class="t">{{ fmt(b.start) }}</span>
            <span class="n"><b>{{ b.name || $t("components.restaurant.walkInName") }} <i v-if="b.pinned" class="pi pi-thumbtack" :aria-label="$t('components.restaurant.pinnedMark')"></i> <i v-if="b.allergies" class="pi pi-exclamation-triangle" :aria-label="$t('components.restaurant.allergies')"></i></b>
              <small>{{ $t("components.restaurant.peopleShort", { n: b.party }) }} · {{ seatsOf(b) }} · {{ stateText(b) }}</small></span>
            <button v-if="b.state === 'booked' || b.state === 'arrived'" class="quick" :disabled="busy" @click.stop="$emit('state', b, 'seated')">{{ $t("components.restaurant.state.seatedShort") }}</button>
            <button v-else-if="b.state === 'seated'" class="quick" :disabled="busy" @click.stop="$emit('state', b, 'left')">{{ $t("components.restaurant.state.leftShort") }}</button>
          </div>
          <p v-if="!groups[filter].length" class="muted">{{ $t("components.restaurant.list.empty") }}</p>
          <details v-if="gone.length" class="gone"><summary>{{ $t("components.restaurant.list.gone", { n: gone.length }) }}</summary>
            <div v-for="b in gone" :key="b.id" class="brow dim" role="button" tabindex="0" @click="$emit('open', b.id)" @keydown.enter.prevent="$emit('open', b.id)">
              <span class="t">{{ fmt(b.start) }}</span>
              <span class="n"><b>{{ b.name }}</b><small>{{ $t("components.restaurant.peopleShort", { n: b.party }) }} · {{ stateText(b) }}</small></span>
            </div>
          </details>
        </aside>
      </div>
    </template>
  </section>
</template>

<script>
import {
  addDays, fmt, live, guests, usableTables, orderedZones, zoneOpen, tableAt, freeFrom, isFreeAt, tableById, seatLabel, occupiedTables,
  knowCounts, matches, callsOf, dropTargets, serviceWindow
} from "@/utils/RestaurantModel";
import { longDate, refusalKey } from "@/components/widgets/restaurant/format";

const KNOW_CLASS = { allergies: "red", groups: "blue" };
const FILTERS = ["all", "waiting", "seated", "left"];

/**
 * One service of one day: who is booked, where they sit, what is free at the chosen time.
 *
 * A table is green at a time only when it stays free from then for the minimum free time; one that frees
 * for less is grey and says when it frees. The finder's seatings are the server's answer; while a booking is
 * being moved, the tables it physically fits on are outlined, and the server judges the move.
 */
export default {
  props: {
    date: { type: String, required: true },
    today: { type: String, required: true },
    service: { type: String, required: true },
    time: { type: Number, required: true },
    win: { type: Object, default: null },
    rules: { type: Object, required: true },
    layout: { type: Object, required: true },
    list: { type: Array, required: true },
    heldTables: { type: Array, default: () => [] },
    /** The server's free windows per table id (the day read's `freeTables`), and the minimum they are judged by. */
    freeTables: { type: Object, default: () => ({}) },
    minFreeMinutes: { type: Number, required: true },
    summaries: { type: Object, default: null },
    find: { type: Number, default: 0 },
    findAnswer: { type: Object, default: null },
    moving: { type: String, default: null },
    search: { type: String, default: "" },
    busy: { type: Boolean, default: false },
  },
  emits: ["go-day", "set-service", "set-time", "find", "open", "tile-free", "fit-book", "new-booking", "timeline-new", "state",
    "move-cancel", "move-to", "drop", "accept", "decline", "call"],
  data() {
    return { KNOW_CLASS, FILTERS, mode: "floor", filter: "all", know: null };
  },
  computed: {
    minFree() {
      return this.minFreeMinutes;
    },
    /** Closed when the server's period says so, and when the weekly hours have no window to draw it in. */
    closed() {
      return this.isClosed(this.service) || !this.win;
    },
    usable() {
      return usableTables(this.layout, this.date);
    },
    capacity() {
      return this.usable.reduce((a, t) => a + t.max, 0);
    },
    freeNow() {
      return this.freeCountAt(this.time);
    },
    chips() {
      const out = [];
      if (!this.win) return out;
      for (let t = this.win.open; t <= this.win.close - 30; t += this.win.step) out.push({ t, free: this.freeCountAt(t) });
      return out;
    },
    knowCounts() {
      return knowCounts(this.list, this.service);
    },
    knowKeys() {
      return Object.keys(this.knowCounts).filter(k => this.knowCounts[k].length);
    },
    hits() {
      return this.know ? this.knowCounts[this.know] : [];
    },
    movingBooking() {
      return this.moving ? this.list.find(b => b.id === this.moving) || null : null;
    },
    /** While moving: every table on which the booking physically fits for its interval. */
    moveOk() {
      const b = this.movingBooking;
      const ok = new Set();
      if (b) this.layout.tables.forEach(t => { if (dropTargets(this.layout, this.date, this.list, b, t.id).length) ok.add(t.id); });
      return ok;
    },
    /** The finder's seatings by table: which fit each table belongs to, the first being the best. */
    fitIds() {
      const m = new Map();
      const fits = this.findAnswer && this.findAnswer.fits ? this.findAnswer.fits : [];
      fits.forEach((f, i) => f.ids.forEach(id => { if (!m.has(id)) m.set(id, { i, f }); }));
      return m;
    },
    zones() {
      return orderedZones(this.layout).map(zone => {
        const tables = this.layout.tables.filter(t => t.zone === zone.id && t.active);
        const open = zoneOpen(zone, this.date);
        if (!tables.length) return null;
        const tiles = [];
        const done = new Set();
        let freeN = 0;
        tables.forEach(t => {
          if (done.has(t.id)) return;
          const info = tableAt(this.list, this.service, t.id, this.time);
          if (info.cur) {
            const members = occupiedTables(info.cur).map(id => tableById(this.layout, id)).filter(m => m && m.zone === zone.id);
            members.forEach(m => done.add(m.id));
            tiles.push(this.busyTile(info.cur, members.length ? members : [t]));
          } else {
            done.add(t.id);
            const tile = this.freeTile(t, info);
            if (tile.free) freeN++;
            tiles.push(tile);
          }
        });
        return { zone, tables, open, tiles, freeN };
      }).filter(Boolean);
    },
    span() {
      return this.win ? this.win.close - this.win.open : 1;
    },
    slots() {
      return this.win ? Math.round(this.span / this.win.step) : 1;
    },
    ticks() {
      const out = [];
      if (!this.win) return out;
      for (let m = this.win.open; m <= this.win.close; m += 30) out.push(m);
      return out;
    },
    serviceGuests() {
      return guests(this.list, this.service).sort((a, b) => a.start - b.start || (a.name || "").localeCompare(b.name || ""));
    },
    active() {
      return this.serviceGuests.filter(b => ["booked", "arrived", "seated", "left"].includes(b.state));
    },
    gone() {
      return this.serviceGuests.filter(b => b.state === "cancelled" || b.state === "noshow");
    },
    requests() {
      return this.serviceGuests.filter(b => b.state === "requested");
    },
    orphans() {
      return this.active.filter(b => !b.tables.length && b.state !== "left");
    },
    groups() {
      return {
        all: this.active,
        waiting: this.active.filter(b => b.state === "booked" || b.state === "arrived"),
        seated: this.active.filter(b => b.state === "seated"),
        left: this.active.filter(b => b.state === "left"),
      };
    },
    blockName() {
      return this.$t("components.restaurant.floor.blocked");
    },
  },
  watch: {
    date() { this.know = null; },
    service() { this.know = null; },
  },
  methods: {
    fmt,
    longDate(key) {
      return longDate(key, this.$i18n.locale);
    },
    shift(n) {
      return addDays(this.date, n);
    },
    isClosed(s) {
      const sum = this.summaries ? this.summaries[s] : null;
      if (sum && sum.open === false) return true;
      if (sum && sum.open) return false;
      return !serviceWindow(this.rules, this.date, s);
    },
    coversOf(s) {
      return live(this.list, s).filter(b => b.state !== "block").reduce((a, b) => a + b.party, 0);
    },
    freeCountAt(t) {
      return this.usable.filter(tb => isFreeAt(this.freeTables[tb.id], t, this.minFree)).length;
    },
    zoneName(id) {
      const z = this.layout.zones.find(x => x.id === id);
      return z ? z.name : "";
    },
    sizeLabel(t) {
      return t.min === t.max ? this.$t("components.restaurant.seats", { n: t.max }) : this.$t("components.restaurant.seatsRange", { min: t.min, max: t.max });
    },
    seatsOf(b) {
      return b.tables.length ? seatLabel(this.layout, b.tables) : this.$t("components.restaurant.noTable");
    },
    isMatch(b) {
      return matches(b, this.search);
    },
    isHit(b) {
      return this.hits.some(h => h.id === b.id);
    },
    hasCalls(b) {
      return callsOf(b).length > 0;
    },
    knowDetail(b) {
      if (this.know === "allergies") return b.allergies;
      return this.$t("components.restaurant.people", { n: b.party });
    },
    refusalKey,
    stateOfTile(b) {
      const t = this.time;
      if (b.state === "block") return { cls: "blocked", text: this.blockName };
      if (b.state === "seated") return { cls: "busy", text: this.$t("components.restaurant.tile.seated", { time: fmt(b.end) }) };
      if (b.state === "arrived") return { cls: "arrived", text: this.$t("components.restaurant.tile.arrived") };
      if (b.state === "left") return { cls: "busy", text: this.$t("components.restaurant.tile.left", { time: fmt(b.end) }) };
      const late = this.date === this.today ? t - b.start : 0;
      if (late >= 10) return { cls: "booked late", text: this.$t("components.restaurant.tile.late", { n: late }) };
      return { cls: "booked", text: this.$t("components.restaurant.tile.coming", { time: fmt(b.start) }) };
    },
    stateText(b) {
      if (b.state === "cancelled" || b.state === "noshow") return this.$t(`components.restaurant.state.${b.state}`);
      return this.stateOfTile(b).text;
    },
    rowClass(b) {
      return { dim: b.state === "left", match: this.isMatch(b), hit: this.isHit(b) };
    },
    hitsOn(ids, shownId) {
      return this.hits.filter(h => h.id !== shownId && occupiedTables(h).some(i => ids.includes(i)));
    },
    busyTile(b, members) {
      const st = this.stateOfTile(b);
      const joined = members.length > 1;
      const hits = this.hitsOn(members.map(m => m.id), b.id);
      const names = members.map(m => m.name).join(" + ");
      const who = b.state === "block" ? (b.notes || this.blockName) : `${b.name || this.$t("components.restaurant.walkInName")} · ${b.party}`;
      return {
        busy: true, key: `b-${b.id}-${members[0].id}`, b, members, names, who, hits,
        seats: joined ? this.$t("components.restaurant.floor.joinSeats", { n: members.reduce((a, m) => a + m.max, 0) }) : this.sizeLabel(members[0]),
        foot: st.text,
        cls: [st.cls, { joined, wide: joined && members.length > 2, match: this.isMatch(b), hit: this.isHit(b) || hits.length > 0, nofit: !!this.moving }],
        aria: `${names}, ${who}, ${st.text}`,
      };
    },
    freeTile(t, info) {
      const from = freeFrom(this.freeTables[t.id], this.time, this.minFree);
      const free = from === this.time;
      const fit = this.fitIds.get(t.id);
      const hits = this.hitsOn([t.id], null);
      const cls = { free, short: !free, fit: !!fit || (!!this.moving && this.moveOk.has(t.id)),
        nofit: (this.find > 0 && this.findAnswer && this.findAnswer.fits && !fit) || (!!this.moving && !this.moveOk.has(t.id)),
        hit: hits.length > 0 };
      const foot = !free ? this.$t("components.restaurant.tile.notAvailable")
        : info.next ? this.$t("components.restaurant.tile.freeUntil", { time: fmt(info.next.start) }) : this.$t("components.restaurant.tile.free");
      const sub = free ? "" : from !== null ? this.$t("components.restaurant.tile.freeFrom", { time: fmt(from) }) : this.$t("components.restaurant.tile.neverFree");
      const gap = info.next ? info.next.start - this.time : null;
      const nextLine = info.next ? (free ? "" : this.$t("components.restaurant.tile.only", { n: gap }) + " ") +
        this.$t("components.restaurant.tile.then", { time: fmt(info.next.start), name: info.next.state === "block" ? this.blockName : info.next.name, party: info.next.party }) : "";
      return {
        busy: false, key: `t-${t.id}`, t, free, cls, foot, sub, hits, next: info.next, nextLine, left: info.left,
        held: this.heldTables.includes(t.id),
        best: !!fit && fit.i === 0 && fit.f.ids[0] === t.id,
        with: fit && fit.f.joined ? fit.f.ids.filter(i => i !== t.id).map(i => (tableById(this.layout, i) || {}).name).join("+") : "",
        aria: [t.name, this.sizeLabel(t), foot, sub].filter(Boolean).join(", "),
      };
    },
    barsOf(tableId) {
      return live(this.list, this.service).filter(b => occupiedTables(b).includes(tableId));
    },
    barClass(b) {
      return b.state === "seated" ? "" : b.state;
    },
    pct(m) {
      return (((m - this.win.open) / this.span) * 100).toFixed(3) + "%";
    },
    minuteAt(e, round) {
      const r = e.currentTarget.getBoundingClientRect();
      const step = this.win.step;
      const raw = ((e.clientX - r.left) / r.width) * this.span / step;
      const m = this.win.open + (round ? Math.round(raw) : Math.floor(raw)) * step;
      return Math.max(this.win.open, Math.min(m, round ? this.win.close - 30 : this.win.last + 30));
    },
    dragStart(e, b) {
      if (b.state === "block") return;
      e.dataTransfer.setData("text/plain", b.id);
      e.dataTransfer.effectAllowed = "move";
    },
    dropped(e, tableId) {
      e.currentTarget.classList.remove("drop-over");
      const id = e.dataTransfer.getData("text/plain");
      if (id) this.$emit("drop", { bookingId: id, tableId });
    },
  },
};
</script>
