<template>
  <div class="rb restaurant">
    <Message v-if="unavailable" severity="info" :closable="false" class="restaurant-unavailable">
      {{ $t("components.restaurant.unavailable") }}
    </Message>
    <Message v-else-if="noSkill" severity="info" :closable="false" class="restaurant-unavailable">
      {{ $t("components.restaurant.noSkill") }}
    </Message>
    <Message v-else-if="loadError" severity="error" :closable="false">{{ $t("components.restaurant.loadError") }}</Message>

    <template v-else-if="ready">
      <RestaurantWizard v-if="!layout" :user="user" :business-id="businessId" :instance="instance" :rules="rules"
                        @instance-saved="loadInstance" @done="onWizardDone" />

      <template v-else>
        <div class="rb-head">
          <div class="tabs" role="tablist" :aria-label="$t('components.restaurant.sections')">
            <button role="tab" class="tab" :aria-selected="tab === 'day'" @click="setTab('day')">{{ $t("components.restaurant.tabDay") }}</button>
            <button role="tab" class="tab" :aria-selected="tab === 'room'" @click="setTab('room')">{{ $t("components.restaurant.tabRoom") }}</button>
          </div>
          <div class="head-tools">
            <div class="search">
              <input v-model="search" type="search" :placeholder="$t('components.restaurant.searchPlaceholder')"
                     :aria-label="$t('components.restaurant.searchLabel')" autocomplete="off" @input="onSearch" @keydown.esc="search = ''" />
              <div v-if="search.trim().length >= 2" class="search-results" role="listbox">
                <button v-for="r in searchResults" :key="r.b.id" class="sr-item" role="option" @click="openFound(r)">
                  <b>{{ r.b.name }}</b> · {{ $t("components.restaurant.peopleShort", { n: r.b.party }) }}<template v-if="r.b.phone"> · {{ r.b.phone }}</template><br>
                  <small>{{ shortDate(r.date) }} · {{ $t(`components.restaurant.service.${r.b.service}`) }} {{ fmt(r.b.start) }} · {{ seatLabelOf(r.b) }}
                    <template v-if="r.b.state === 'cancelled'"> · {{ $t("components.restaurant.state.cancelled") }}</template></small>
                </button>
                <div v-if="!searchResults.length" class="sr-empty">
                  {{ searching ? $t("components.restaurant.searching") : $t("components.restaurant.searchNone", { days: SEARCH_DAYS }) }}
                </div>
              </div>
            </div>
            <button class="btn ghost" :title="$t('components.restaurant.exportHint')" @click="exportCsv">{{ $t("components.restaurant.export") }}</button>
          </div>
        </div>

        <RestaurantRoomEditor v-if="tab === 'room'" :user="user" :business-id="businessId" :layout="layout" :instance="instance"
                              :rules="rules" :today="today" :bookings-on="bookingsOnTable"
                              @saved="onRoomSaved" @instance-saved="loadInstance" @toast="showToast" />

        <template v-else>
          <RestaurantStrip :cells="stripCells" :mode="stripMode" :title="stripTitle" @go-day="setDate" @shift="shiftStrip"
                           @mode="setStripMode" />
          <RestaurantDayView :date="date" :today="today" :service="service" :time="time" :win="win" :rules="rules" :layout="layout"
                             :list="list" :held-tables="day ? day.heldTables : []" :summaries="periodOf(date)" :find="find"
                             :find-answer="findAnswer" :moving="moving" :search="search" :busy="busy"
                             @go-day="setDate" @set-service="setService" @set-time="setTime" @find="setFind"
                             @open="openBooking" @tile-free="tileFree" @fit-book="fitBook" @new-booking="openNew(null, time, find || 2)"
                             @timeline-new="timelineNew" @state="setState" @move-cancel="moving = null" @move-to="moveTo" @drop="dropOn"
                             @accept="accept" @decline="decline" @call="openCalls" />
        </template>
      </template>
    </template>

    <template v-if="panel">
      <div class="scrim" @click="closePanel"></div>
      <aside class="panel" :aria-label="$t('components.restaurant.panelLabel')" @keydown.esc="closePanel">
        <RestaurantBookingPanel v-if="panel.type === 'booking' && panelBooking" :booking="panelBooking" :layout="layout" :date="date"
                                :busy="busy" @close="closePanel" @state="setState" @pin="togglePin" @no-show="noShow" @cancel="cancel"
                                @move="startMove" @call="openCalls" />
        <RestaurantNewPanel v-else-if="panel.type === 'new'" :key="panel.key" :draft="panel" :message="panel.message" :layout="layout"
                            :date="date" :service="service" :win="win" :rules="rules" :list="list" :is-today="date === today" :busy="busy"
                            :find-answer="newFit" @close="closePanel" @save="saveNew" @walk-in="walkIn" @changed="askNewFit" />
      </aside>
    </template>

    <RestaurantCallModal v-model:visible="calls.visible" :ids="calls.ids" :title="calls.title" :user="user" :business-id="businessId" />

    <div class="toasts" aria-live="polite">
      <div v-if="toast" class="toast" :class="{ err: toast.error }" role="status">
        <span>{{ toast.text }}</span>
        <button v-if="toast.undo" :disabled="busy" @click="undo">{{ $t("components.restaurant.undo") }}</button>
      </div>
    </div>
  </div>
</template>

<script>
import { useConfirm } from "primevue/useconfirm";
import RestaurantApi, { isMissingRoute } from "@/utils/Restaurant";
import {
  rulesOf, serviceWindow, serviceAt, defaultTime, arrivalTimes, keyOf, addDays, dateOf, fmt, toMin, minuteOfDay,
  stripStatus, seatLabel, dropTargets, tableById, freeFrom, matches, live, occupiedTables, callsOf, SERVICES
} from "@/utils/RestaurantModel";
import { longDate, shortDate, monthTitle, refusalKey, OVERRIDABLE } from "@/components/widgets/restaurant/format";
import RestaurantStrip from "@/components/widgets/restaurant/RestaurantStrip.vue";
import RestaurantDayView from "@/components/widgets/restaurant/RestaurantDayView.vue";
import RestaurantBookingPanel from "@/components/widgets/restaurant/RestaurantBookingPanel.vue";
import RestaurantNewPanel from "@/components/widgets/restaurant/RestaurantNewPanel.vue";
import RestaurantRoomEditor from "@/components/widgets/restaurant/RestaurantRoomEditor.vue";
import RestaurantWizard from "@/components/widgets/restaurant/RestaurantWizard.vue";
import RestaurantCallModal from "@/components/widgets/restaurant/RestaurantCallModal.vue";

/** The days the search reads ahead, from today: the period strip's. */
const SEARCH_DAYS = 14;

/**
 * "Prenotazioni Ristorante": the service-time page of a restaurant whose assistant books its tables.
 *
 * The specification is the prototype Angelo approved on 2026-10-11, committed in
 * docs/design/restaurant-page-prototype/. Two tabs: the evening ("Serata": the period strip, the day by
 * service with the tables by zone or on a timeline, the bookings, the finder) and the room ("Sala e
 * tavoli": zones, tables, joins, the minimum free time). A restaurant with no layout opens on the wizard.
 *
 * StarChat decides everything: whether a party fits, where it sits, whether a layout may be saved. The page
 * reads the day and the period, asks, and shows the answers in the owner's language, never the server's
 * English. Every change goes to the server at the version it was read at; the ones the server can reverse
 * (a state, a pin, a move, a new booking) offer Undo, the two it cannot (a cancellation, a no-show) are
 * confirmed first with "Keep it" focused. Without the restaurant routes (404) the page says so and offers
 * nothing.
 */
export default {
  components: { RestaurantStrip, RestaurantDayView, RestaurantBookingPanel, RestaurantNewPanel, RestaurantRoomEditor, RestaurantWizard, RestaurantCallModal },
  setup() {
    return { confirm: useConfirm() };
  },
  props: {
    businessId: { type: String, required: true },
    user: { type: Object, required: true },
  },
  data() {
    const today = keyOf(new Date());
    return {
      SEARCH_DAYS,
      today,
      ready: false,
      unavailable: false,
      noSkill: false,
      loadError: false,
      busy: false,
      instance: null,
      tab: this.$route && this.$route.query && this.$route.query.tab === "room" ? "room" : "day",
      date: today,
      service: "dinner",
      time: 0,
      days: {},
      period: {},
      stripMode: "14",
      stripStart: today,
      monthKey: today.slice(0, 7),
      find: 0,
      findAnswer: null,
      newFit: null,
      moving: null,
      search: "",
      searching: false,
      panel: null,
      calls: { visible: false, ids: [], title: "" },
      toast: null,
      lastRefusal: null,
      searchLoaded: false,
    };
  },
  computed: {
    rules() {
      return rulesOf(this.instance ? this.instance.params : {});
    },
    day() {
      return this.days[this.date] || null;
    },
    /** The layout as the last day read returned it: one read gives the rows and the room they sit in. */
    layout() {
      const any = this.day || Object.values(this.days)[0];
      return any ? any.layout : null;
    },
    list() {
      return this.day ? this.day.reservations : [];
    },
    win() {
      return serviceWindow(this.rules, this.date, this.service);
    },
    panelBooking() {
      return this.panel && this.panel.type === "booking" ? this.list.find(b => b.id === this.panel.id) || null : null;
    },
    stripDays() {
      if (this.stripMode === "14") return Array.from({ length: 14 }, (_, i) => addDays(this.stripStart, i));
      const [y, m] = this.monthKey.split("-").map(Number);
      const n = new Date(y, m, 0).getDate();
      return Array.from({ length: n }, (_, i) => keyOf(new Date(y, m - 1, i + 1)));
    },
    stripTitle() {
      const locale = this.$i18n.locale;
      if (this.stripMode === "14") return `${shortDate(this.stripDays[0], locale)} - ${shortDate(this.stripDays[13], locale)}`;
      return monthTitle(this.monthKey + "-01", locale);
    },
    stripCells() {
      const lead = this.stripMode === "month" ? (dateOf(this.stripDays[0]).getDay() + 6) % 7 : 0;
      const blanks = Array.from({ length: lead }, (_, i) => ({ blank: true, key: `blank-${i}` }));
      return blanks.concat(this.stripDays.map(key => {
        const summaries = this.periodOf(key);
        const services = {};
        SERVICES.forEach(s => {
          const sum = summaries ? summaries[s] : null;
          const win = serviceWindow(this.rules, key, s);
          const past = key < this.today || (key === this.today && win && minuteOfDay(new Date()) >= win.close - 30);
          services[s] = sum
            ? { status: stripStatus(sum, { past, arrivals: arrivalTimes(win).length, step: this.rules.step }), max: sum.largestParty, covers: sum.coversTaken, bookable: sum.bookable || {} }
            : { status: key < this.today ? "past" : "unknown" };
        });
        return { key, sel: key === this.date, today: key === this.today, services };
      }));
    },
    searchResults() {
      const q = this.search;
      if (q.trim().length < 2) return [];
      const out = [];
      Object.keys(this.days).sort().forEach(date => (this.days[date].reservations || []).forEach(b => {
        if (b.state !== "block" && b.source !== "walk_in" && matches(b, q)) out.push({ date, b });
      }));
      return out.filter(r => r.date >= this.today).concat(out.filter(r => r.date < this.today).reverse()).slice(0, 10);
    },
  },
  watch: {
    date() {
      this.moving = null;
    },
  },
  async mounted() {
    try {
      await this.loadInstance();
      if (this.noSkill) return;
      this.service = serviceAt(this.rules, this.date, minuteOfDay(new Date()));
      await this.loadDay(this.date);
      this.resetTime();
      this.ready = !this.unavailable;
      this.loadPeriod();
    } catch (e) {
      console.error("Restaurant page not loaded:", e.restaurant ? e.restaurant.status : e);
      this.loadError = true;
    }
  },
  methods: {
    fmt,
    shortDate(key) {
      return shortDate(key, this.$i18n.locale);
    },
    seatLabelOf(b) {
      return b.tables.length ? seatLabel(this.layout || { tables: [] }, b.tables) : this.$t("components.restaurant.noTable");
    },

    // ------------------------------------------------------------ reading

    async loadInstance() {
      this.instance = await RestaurantApi.instance(this.user, this.businessId);
      // A business that runs no restaurant skill has no book: the page says so instead of offering one.
      this.noSkill = !this.instance;
    },
    async loadDay(date) {
      try {
        const day = await RestaurantApi.day(this.user, this.businessId, date);
        this.days = Object.assign({}, this.days, { [date]: day });
        return day;
      } catch (e) {
        if (isMissingRoute(e)) this.unavailable = true;
        else throw e;
        return null;
      }
    },
    /** The period strip, read a month at a time at most, from today to the horizon. */
    async loadPeriod() {
      const horizon = addDays(this.today, this.rules.daysAhead);
      const from = this.stripDays[0] < this.today ? this.today : this.stripDays[0];
      const last = this.stripDays[this.stripDays.length - 1];
      const to = last > horizon ? horizon : last;
      if (to < from) return;
      try {
        const answer = await RestaurantApi.period(this.user, this.businessId, from, to);
        const next = Object.assign({}, this.period);
        (answer.days || []).forEach(d => {
          next[d.date] = Object.fromEntries((d.services || []).map(s => [s.service, s]));
        });
        this.period = next;
      } catch (e) {
        // The strip stays grey: the day below still works.
        console.warn("Restaurant period not read:", e.restaurant ? e.restaurant.code || e.restaurant.status : e);
      }
    },
    periodOf(key) {
      return this.period[key] || null;
    },
    async reload() {
      await this.loadDay(this.date);
      this.loadPeriod();
      if (this.find) this.askFinder();
    },

    // ------------------------------------------------------------ navigation

    resetTime() {
      this.time = defaultTime(this.win, this.date === this.today, minuteOfDay(new Date()));
    },
    async setDate(key) {
      if (!key) return;
      this.panel = null;
      this.date = key;
      if (this.stripMode === "14" && (key < this.stripStart || key > addDays(this.stripStart, 13))) {
        this.stripStart = key < this.today ? key : (key <= addDays(this.today, 13) ? this.today : key);
        this.loadPeriod();
      }
      if (this.stripMode === "month" && key.slice(0, 7) !== this.monthKey) {
        this.monthKey = key.slice(0, 7);
        this.loadPeriod();
      }
      this.resetTime();
      await this.loadDay(key);
      if (this.find) this.askFinder();
    },
    setService(s) {
      this.service = s;
      this.moving = null;
      this.resetTime();
      if (this.find) this.askFinder();
    },
    setTime(t) {
      this.time = t;
      if (this.find) this.askFinder();
    },
    shiftStrip(n) {
      if (this.stripMode === "14") this.stripStart = addDays(this.stripStart, n);
      else {
        const [y, m] = this.monthKey.split("-").map(Number);
        this.monthKey = keyOf(new Date(y, m - 1 + n, 1)).slice(0, 7);
      }
      this.loadPeriod();
    },
    setStripMode(mode) {
      this.stripMode = mode;
      this.monthKey = this.date.slice(0, 7);
      this.loadPeriod();
    },
    setTab(tab) {
      this.tab = tab;
      this.panel = null;
      this.moving = null;
    },

    // ------------------------------------------------------------ the finder, asked of the server

    setFind(n) {
      this.find = n;
      if (n) this.askFinder();
      else this.findAnswer = null;
    },
    async askFinder() {
      const asked = { date: this.date, time: this.time, party: this.find };
      this.findAnswer = { loading: true, ...asked };
      try {
        const answer = await RestaurantApi.seatings(this.user, this.businessId, this.date, fmt(this.time), this.find);
        if (this.date !== asked.date || this.time !== asked.time || this.find !== asked.party) return;
        this.findAnswer = answer === null ? { unavailable: true, ...asked } : { ...asked, ...this.fitsOf(answer) };
      } catch (e) {
        console.warn("Restaurant finder not answered:", e.restaurant ? e.restaurant.code || e.restaurant.status : e);
        this.findAnswer = { error: true, ...asked };
      }
    },
    fitsOf(answer) {
      const fits = (answer.fits || []).map(f => ({ ids: (f.tableIds || []).slice(), zone: f.zone, joined: !!f.joined,
        label: seatLabel(this.layout, f.tableIds || []) }));
      return { fits, later: (answer.later || []).map(toMin).filter(t => t !== null) };
    },
    fitBook(i) {
      const fit = this.findAnswer && this.findAnswer.fits ? this.findAnswer.fits[i] : null;
      if (fit) this.openNew(fit.ids, this.time, this.find);
    },

    // ------------------------------------------------------------ panels

    openBooking(id) {
      if (this.moving) {
        this.showToast(this.$t("components.restaurant.moveTapFree"));
        return;
      }
      this.panel = { type: "booking", id };
    },
    openNew(tables, start, party, extra) {
      const last = this.win ? this.win.last : start;
      this.panel = Object.assign({ type: "new", key: Date.now(), tables: tables && tables.length ? tables.slice() : null,
        start: Math.min(start, last + 30), party: party || 2, name: "", phone: "", notes: "", allergies: "", message: null }, extra || {});
      this.askNewFit(this.panel);
    },
    /** What the server would give the new booking, shown before it is saved: the finder's answer. */
    async askNewFit(form) {
      const p = { start: form.start, party: form.party };
      this.asked = p;
      this.newFit = { loading: true };
      try {
        const answer = await RestaurantApi.seatings(this.user, this.businessId, this.date, fmt(p.start), p.party);
        if (this.asked !== p) return;
        this.newFit = answer === null ? { unavailable: true } : this.fitsOf(answer);
      } catch (e) {
        console.warn("Restaurant finder not answered:", e.restaurant ? e.restaurant.code || e.restaurant.status : e);
        this.newFit = { error: true };
      }
    },
    closePanel() {
      this.panel = null;
      this.moving = null;
    },
    tileFree(tid) {
      if (this.moving) return this.moveTo(tid);
      if (this.find && this.findAnswer && this.findAnswer.fits) {
        const fit = this.findAnswer.fits.find(f => f.ids.includes(tid));
        if (fit) return this.openNew(fit.ids, this.time, this.find);
      }
      const t = tableById(this.layout, tid);
      // a table not free long enough opens on the time it frees up
      const from = freeFrom(this.list, this.service, tid, this.time, this.rules.minFreeMinutes, this.win);
      this.openNew([tid], from !== null ? from : this.time, Math.min(t.max, Math.max(t.min, 2)));
    },
    timelineNew({ tableId, minute }) {
      const t = tableById(this.layout, tableId);
      this.openNew([tableId], minute, Math.min(t.max, Math.max(t.min, 2)));
    },
    async openCalls(b) {
      const ids = callsOf(b);
      if (!ids.length) return;
      this.calls = { visible: true, ids, title: b.name || "" };
    },

    // ------------------------------------------------------------ writing

    /** Runs one change, reloads the day, and says what happened with Undo when the server can reverse it. */
    async act(run, { done, undo, inPanel } = {}) {
      if (this.busy) return null;
      this.busy = true;
      this.lastRefusal = null;
      try {
        const answer = await run();
        await this.reload();
        this.showToast(done ? done(answer) : this.$t("components.restaurant.saved"), undo ? () => undo(answer) : null);
        return answer || true;
      } catch (e) {
        const code = e.restaurant ? e.restaurant.code : null;
        this.lastRefusal = this.refusalOf(e);
        if (code === "stale") await this.reload();
        if (!e.restaurant || e.restaurant.status >= 500 || !e.restaurant.status) {
          console.error("Restaurant change failed:", e.restaurant ? e.restaurant.status : e);
        }
        if (inPanel && this.panel) {
          this.panel = Object.assign({}, this.panel, { message: this.lastRefusal });
        } else {
          this.showToast(this.$t(refusalKey(code)), null, true);
        }
        return null;
      } finally {
        this.busy = false;
      }
    },
    refusalOf(e) {
      const body = (e.restaurant && e.restaurant.body) || {};
      const code = e.restaurant ? e.restaurant.code : null;
      return {
        code, text: this.$t(refusalKey(code)), overridable: OVERRIDABLE.includes(code),
        alternatives: (body.alternatives || []).filter(a => a.date === this.date).map(a => toMin(a.time)).filter(t => t !== null),
      };
    },
    showToast(text, undo = null, error = false) {
      clearTimeout(this.toastTimer);
      this.toast = { text, undo, error };
      this.toastTimer = setTimeout(() => { this.toast = null; }, undo ? 8000 : 5000);
    },
    async undo() {
      const run = this.toast && this.toast.undo;
      if (!run) return;
      this.toast = null;
      await this.act(run, { done: () => this.$t("components.restaurant.undone") });
    },
    stateWord(st) {
      return this.$t(`components.restaurant.stateDone.${st}`);
    },
    setState(b, st) {
      const before = b.serviceState || null;
      const wire = st === "booked" ? null : st;
      if (wire === before) return;
      return this.act(() => RestaurantApi.state(this.user, this.businessId, b.id, b.version, wire), {
        done: () => `${b.name || this.$t("components.restaurant.walkInName")}: ${this.stateWord(st)}`,
        undo: answer => RestaurantApi.state(this.user, this.businessId, b.id, answer.version, before),
      });
    },
    togglePin(b) {
      return this.act(() => RestaurantApi.pin(this.user, this.businessId, b.id, b.version, !b.pinned), {
        done: () => this.$t(b.pinned ? "components.restaurant.unpinned" : "components.restaurant.pinned", { name: b.name }),
        undo: answer => RestaurantApi.pin(this.user, this.businessId, b.id, answer.version, b.pinned),
      });
    },
    /** Cancelling and marking a no-show cannot be undone on the server, so each is confirmed first, naming
     *  the party, with "Keep it" focused. */
    askIrreversible(kind, b, run) {
      this.confirm.require({
        header: this.$t(`components.restaurant.confirm.${kind}Title`),
        message: this.$t("components.restaurant.confirm.message", {
          who: b.name || this.$t("components.restaurant.walkInName"), day: longDate(this.date, this.$i18n.locale).toLowerCase(),
          time: fmt(b.start), people: this.$t("components.restaurant.people", { n: b.party }) }),
        icon: "pi pi-exclamation-triangle",
        acceptLabel: this.$t(`components.restaurant.confirm.${kind}`),
        rejectLabel: this.$t("components.restaurant.confirm.keep"),
        acceptClass: "p-button-danger",
        defaultFocus: "reject",
        accept: run,
      });
    },
    cancel(b) {
      this.askIrreversible(b.state === "requested" ? "decline" : "cancel", b, async () => {
        const ok = await this.act(() => RestaurantApi.cancel(this.user, this.businessId, b.id, b.version), {
          done: () => this.$t(b.state === "requested" ? "components.restaurant.declined" : "components.restaurant.cancelled", { name: b.name }),
        });
        if (ok) this.panel = null;
      });
    },
    decline(b) {
      this.cancel(b);
    },
    noShow(b) {
      this.askIrreversible("noShow", b, () => this.act(() => RestaurantApi.noShow(this.user, this.businessId, b.id, b.version), {
        done: () => this.$t("components.restaurant.noShowDone", { name: b.name }),
      }));
    },
    /** Accepts a request: the server seats it. Refused for room, a person may accept it anyway, beyond what
     *  the assistant sells, after saying so. */
    async accept(b, overbook = false) {
      const ok = await this.act(() => RestaurantApi.accept(this.user, this.businessId, b.id,
        { expectedVersion: b.version, overbook: overbook || undefined }), {
        done: () => this.$t("components.restaurant.acceptedDone", { name: b.name }),
      });
      const refusal = this.lastRefusal;
      if (!ok && !overbook && refusal && refusal.overridable) {
        this.confirm.require({
          header: this.$t("components.restaurant.acceptAnywayTitle"),
          message: refusal.text,
          acceptLabel: this.$t("components.restaurant.bookAnyway"),
          rejectLabel: this.$t("components.restaurant.confirm.keep"),
          defaultFocus: "reject",
          accept: () => {
            const again = this.list.find(r => r.id === b.id);
            if (again) this.accept(again, true);
          },
        });
      }
    },
    startMove(b) {
      this.panel = null;
      this.moving = b.id;
      this.time = b.start;
    },
    moveTo(tableId) {
      const b = this.list.find(x => x.id === this.moving);
      if (!b) { this.moving = null; return; }
      return this.dropOn({ bookingId: b.id, tableId });
    },
    /** A booking dropped on a table: the best declared seating with that table that holds the party and is
     *  free over its interval. The server judges the move. */
    dropOn({ bookingId, tableId }) {
      const b = this.list.find(x => x.id === bookingId);
      const t = tableById(this.layout, tableId);
      if (!b || !t) return;
      const options = dropTargets(this.layout, this.date, this.list, b, tableId);
      if (!options.length) {
        const why = b.party > t.max ? "moveTooMany" : b.party < t.min ? "moveTooFew" : "moveBusy";
        this.showToast(this.$t(`components.restaurant.${why}`, { name: b.name, party: b.party, table: t.name, seats: t.max, min: t.min,
          from: fmt(b.start), to: fmt(b.end) }), null, true);
        return;
      }
      const to = options[0].ids;
      const from = b.tables.slice();
      this.moving = null;
      return this.act(() => RestaurantApi.change(this.user, this.businessId, b.id, { expectedVersion: b.version, tableIds: to }), {
        done: () => this.$t("components.restaurant.movedTo", { name: b.name, tables: seatLabel(this.layout, to) }),
        undo: answer => RestaurantApi.change(this.user, this.businessId, b.id,
          { expectedVersion: answer.version, tableIds: from.length ? from : undefined, time: fmt(b.start) }),
      });
    },
    newBody(p, overbook) {
      return {
        date: this.date, time: fmt(p.start), covers: p.party, name: p.name.trim() || undefined, phone: p.phone.trim() || undefined,
        notes: p.notes.trim() || undefined, allergies: p.allergies.trim() || undefined, tableIds: p.tables || undefined,
        overbook: overbook || undefined,
      };
    },
    async saveNew({ form, overbook }) {
      const p = form;
      const body = this.newBody(p, overbook);
      const ok = await this.act(() => p.requestId
        ? RestaurantApi.accept(this.user, this.businessId, p.requestId, { expectedVersion: p.requestVersion, tableIds: p.tables || undefined, overbook: overbook || undefined })
        : RestaurantApi.book(this.user, this.businessId, body), {
        inPanel: true,
        done: answer => this.$t("components.restaurant.bookedDone", { name: p.name.trim(), people: this.$t("components.restaurant.people", { n: p.party }),
          day: this.shortDate(this.date), time: fmt(p.start), tables: answer && answer.tableNames && answer.tableNames.length ? answer.tableNames.join("+") : "" }),
        undo: p.requestId ? null : answer => RestaurantApi.cancel(this.user, this.businessId, answer.id, answer.version),
      });
      if (ok) this.panel = null;
    },
    async walkIn({ form, party }) {
      const p = form;
      const now = minuteOfDay(new Date());
      let tables = p.tables;
      if (tables) {
        const seat = live(this.list, this.service);
        const t = tables.map(id => tableById(this.layout, id));
        const fits = t.reduce((a, x) => a + x.max, 0) >= party && party >= Math.min(...t.map(x => x.min));
        const clash = seat.some(b => occupiedTables(b).some(id => tables.includes(id)) && b.start < now + this.rules.tableMinutes.upTo2 && b.end > now);
        if (!fits || clash) tables = null;
      }
      const ok = await this.act(() => RestaurantApi.book(this.user, this.businessId,
        { date: this.date, time: fmt(now), covers: party, walkIn: true, tableIds: tables || undefined }), {
        inPanel: true,
        done: answer => this.$t("components.restaurant.walkInDone", { party,
          tables: answer && answer.tableNames && answer.tableNames.length ? answer.tableNames.join("+") : "" }),
        undo: answer => RestaurantApi.cancel(this.user, this.businessId, answer.id, answer.version),
      });
      if (ok) this.panel = null;
    },

    // ------------------------------------------------------------ the room

    async onWizardDone() {
      await this.loadDay(this.date);
      this.tab = "day";
      this.resetTime();
      this.loadPeriod();
      this.showToast(this.$t("components.restaurant.wizard.ready", { n: this.layout ? this.layout.tables.length : 0 }));
    },
    async onRoomSaved() {
      const dates = Object.keys(this.days);
      await Promise.all(dates.map(d => this.loadDay(d)));
      this.loadPeriod();
    },
    /** The bookings from today on, among the days the page has read, that sit on a table: for a refused
     *  layout save, which names the table and not who is on it. */
    bookingsOnTable(tableId) {
      return Object.keys(this.days).filter(d => d >= this.today).sort().flatMap(d =>
        this.days[d].reservations.filter(b => ["booked", "arrived", "seated"].includes(b.state) && b.tables.includes(tableId))
          .map(b => ({ date: d, b })));
    },

    // ------------------------------------------------------------ search and export

    async onSearch() {
      if (this.search.trim().length < 2 || this.searchLoaded) return;
      this.searchLoaded = true;
      this.searching = true;
      const missing = Array.from({ length: SEARCH_DAYS }, (_, i) => addDays(this.today, i)).filter(d => !this.days[d]);
      try {
        await Promise.all(missing.map(d => this.loadDay(d)));
      } finally {
        this.searching = false;
      }
    },
    async openFound(r) {
      this.search = "";
      this.tab = "day";
      this.service = r.b.service;
      await this.setDate(r.date);
      this.time = r.b.start;
      this.panel = { type: "booking", id: r.b.id };
    },
    async exportCsv() {
      const from = this.stripDays[0];
      const to = this.stripDays[this.stripDays.length - 1];
      try {
        const blob = await RestaurantApi.exportCsv(this.user, this.businessId, from, to);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob], { type: "text/csv" }));
        a.download = `prenotazioni-${from}-${to}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        this.showToast(this.$t("components.restaurant.exported", { from: this.shortDate(from), to: this.shortDate(to) }));
      } catch (e) {
        this.showToast(this.$t(refusalKey(e.restaurant ? e.restaurant.code : null)), null, true);
      }
    },
  },
};
</script>

<style lang="less">
@import "./restaurant/restaurant.less";
</style>
