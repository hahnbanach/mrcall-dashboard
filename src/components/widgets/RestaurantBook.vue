<template>
  <div class="rb restaurant">
    <!-- the flow of the page, which its layouts measure (restaurant.less, .rb-flow); the fixed panels stay outside -->
    <div class="rb-flow">
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
                    <template v-if="r.b.state === 'cancelled' || r.b.state === 'noshow'"> · {{ $t(`components.restaurant.state.${r.b.state}`) }}</template></small>
                </button>
                <div v-if="searchTruncated" class="sr-empty">{{ $t("components.restaurant.searchTruncated") }}</div>
                <div v-if="!searchResults.length" class="sr-empty">
                  {{ searching ? $t("components.restaurant.searching") : $t("components.restaurant.searchNone") }}
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
                             :list="list" :free-tables="day ? day.freeTables : {}" :min-free-minutes="minFree" :held-tables="day ? day.heldTables : []" :summaries="periodOf(date)" :find="find"
                             :find-answer="findAnswer" :moving="moving" :search="search" :busy="busy"
                             @go-day="setDate" @set-service="setService" @set-time="setTime" @find="setFind"
                             @open="openBooking" @tile-free="tileFree" @fit-book="fitBook" @new-booking="openNew(null, time, find || 2)"
                             @timeline-new="timelineNew" @state="setState" @move-cancel="moving = null" @move-to="moveTo" @drop="dropOn"
                             @accept="accept" @decline="decline" @call="openCalls" @no-show="noShow" />
        </template>
      </template>
    </template>

    </div>

    <template v-if="panel">
      <div class="scrim" @click="closePanel"></div>
      <aside class="panel" :aria-label="$t('components.restaurant.panelLabel')" @keydown.esc="closePanel">
        <RestaurantBookingPanel v-if="panel.type === 'booking' && panelBooking" :booking="panelBooking" :layout="layout" :date="date"
                                :busy="busy" @close="closePanel" @state="setState" @pin="togglePin" @no-show="noShow" @cancel="cancel" @reinstate="reinstate"
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
import DeferredCommit from "@/utils/DeferredCommit";
import {
  rulesOf, serviceWindow, serviceAt, defaultTime, arrivalTimes, keyOf, addDays, dateOf, fmt, toMin, minuteOfDay,
  stripStatus, seatLabel, dropTargets, tableById, freeFrom, live, occupiedTables, callsOf, SERVICES, GUEST_STATES
} from "@/utils/RestaurantModel";
import { shortDate, monthTitle, refusalKey, OVERRIDABLE } from "@/components/widgets/restaurant/format";
import RestaurantStrip from "@/components/widgets/restaurant/RestaurantStrip.vue";
import RestaurantDayView from "@/components/widgets/restaurant/RestaurantDayView.vue";
import RestaurantBookingPanel from "@/components/widgets/restaurant/RestaurantBookingPanel.vue";
import RestaurantNewPanel from "@/components/widgets/restaurant/RestaurantNewPanel.vue";
import RestaurantRoomEditor from "@/components/widgets/restaurant/RestaurantRoomEditor.vue";
import RestaurantWizard from "@/components/widgets/restaurant/RestaurantWizard.vue";
import RestaurantCallModal from "@/components/widgets/restaurant/RestaurantCallModal.vue";

/** How long an Undo is offered, and a held decline waits before it is sent. */
const UNDO_MS = 8000;

/** The most rows one search shows. */
const SEARCH_LIMIT = 20;

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
      deferred: {},
      searchResults: [],
      searchTruncated: false,
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
    /** The day's rows, without the requests whose decline or accept is held back for its Undo. */
    list() {
      return this.day ? this.day.reservations.filter(r => !this.deferred[r.id]) : [];
    },
    win() {
      return serviceWindow(this.rules, this.date, this.service);
    },
    /** The minimum free time the day read judged its free windows by; the instance's when it gave none. */
    minFree() {
      return this.day && this.day.minFreeMinutes ? this.day.minFreeMinutes : this.rules.minFreeMinutes;
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
    }
  },
  watch: {
    date() {
      this.moving = null;
    },
  },
  created() {
    this.commits = new DeferredCommit({ onSend: id => this.deferredSending(id), onSettled: (id, error) => this.deferredSettled(id, error) });
    this.flushCommits = () => this.commits.flush();
    window.addEventListener("pagehide", this.flushCommits);
  },
  /** Leaving the page (another section, another route) sends the held declines now. */
  beforeUnmount() {
    window.removeEventListener("pagehide", this.flushCommits);
    this.unmounted = true;
    this.commits.flush();
    clearTimeout(this.toastTimer);
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
      const answer = await this.askWhere(asked.date, asked.time, asked.party);
      if (this.date !== asked.date || this.time !== asked.time || this.find !== asked.party) return;
      this.findAnswer = { ...asked, ...answer };
    },
    /** Where a party sits at a time, asked of the server's finder (GET /suggestions, the assistant's decision),
     *  and, when nothing fits, the next times of the service at which it would. */
    async askWhere(date, time, party) {
      try {
        const answer = await RestaurantApi.suggestions(this.user, this.businessId, date, fmt(time), party);
        const fits = answer.fits.map(f => ({ ...f, joined: f.ids.length > 1, label: seatLabel(this.layout, f.ids) }));
        return { fits, refusal: answer.refusal, later: fits.length ? [] : answer.later };
      } catch (e) {
        console.warn("Restaurant finder not answered:", e.restaurant ? e.restaurant.code || e.restaurant.status : e);
        return { error: true };
      }
    },
    /** A suggestion that moves other bookings is the server's own re-seating: it is booked without naming
     *  tables, so the server seats it as it suggested (named tables are never re-seated around). */
    fitBook(i) {
      const fit = this.findAnswer && this.findAnswer.fits ? this.findAnswer.fits[i] : null;
      if (fit) this.openNew(fit.moves.length ? null : fit.ids, this.time, this.find);
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
      const answer = await this.askWhere(this.date, p.start, p.party);
      if (this.asked === p) this.newFit = answer;
    },
    closePanel() {
      this.panel = null;
      this.moving = null;
    },
    tileFree(tid) {
      if (this.moving) return this.moveTo(tid);
      if (this.find && this.findAnswer && this.findAnswer.fits) {
        const fit = this.findAnswer.fits.find(f => f.ids.includes(tid));
        if (fit) return this.openNew(fit.moves.length ? null : fit.ids, this.time, this.find);
      }
      const t = tableById(this.layout, tid);
      // a table not free long enough opens on the time it frees up
      const from = freeFrom(this.day.freeTables[tid], this.time, this.minFree);
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
        if (code === "table_taken" && e.reinstating) {
          this.askReinstateWithoutTable(e.reinstating, e.restaurant.body || {});
          return null;
        }
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
    /** A toast; with `undo` (a request to the server) or `localUndo` (a held write dropped) it offers Undo. */
    /** A toast; with `undo` (a request to the server) or `localUndo` (a held write dropped) it offers Undo. A
     *  toast for a held write (`key`) has no timer of its own: it goes when the write is sent. */
    showToast(text, undo = null, error = false, localUndo = null, key = null) {
      clearTimeout(this.toastTimer);
      this.toast = { text, undo: undo || localUndo, server: !!undo, error, key };
      if (!key) this.toastTimer = setTimeout(() => { this.toast = null; }, this.toast.undo ? UNDO_MS : 5000);
    },
    async undo() {
      const toast = this.toast;
      if (!toast || !toast.undo) return;
      this.toast = null;
      if (!toast.server) return toast.undo();
      await this.act(toast.undo, { done: () => this.$t("components.restaurant.undone") });
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
    /**
     * Declining and accepting a request have no server reverse, and will not get one: a declined request is never
     * revived into a booking, an accepted one is a booking like any other. So both are held back
     * (`DeferredCommit`): the request leaves the list at once, the toast offers Undo, and the request is sent only
     * when the Undo window ends, or at once when the page is left. The commit's timer is the only clock: the toast
     * stays until the commit is sent, and an Undo that comes after the send says nothing was undone.
     */
    defer(b, kind, run, text) {
      this.deferred = Object.assign({}, this.deferred, { [b.id]: { kind, b } });
      if (this.panel && this.panel.id === b.id) this.panel = null;
      this.commits.schedule(b.id, run, UNDO_MS);
      this.showToast(text, null, false, () => {
        if (!this.commits.cancel(b.id)) return this.showToast(this.$t("components.restaurant.alreadySent"));
        this.forgetDeferred(b.id);
        this.showToast(this.$t("components.restaurant.undone"));
      }, b.id);
    },
    decline(b) {
      this.defer(b, "decline", () => RestaurantApi.cancel(this.user, this.businessId, b.id, b.version),
        this.$t("components.restaurant.declined", { name: b.name }));
    },
    /** Accepts a request: the server seats it, once the Undo window is over. Refused for room, a person may accept
     *  it anyway, beyond what the assistant sells, after saying so; that accept is held back the same way. */
    accept(b, overbook = false) {
      this.defer(b, overbook ? "acceptAnyway" : "accept",
        () => RestaurantApi.accept(this.user, this.businessId, b.id, { expectedVersion: b.version, overbook: overbook || undefined }),
        this.$t("components.restaurant.acceptedDone", { name: b.name }));
    },
    forgetDeferred(id) {
      const next = Object.assign({}, this.deferred);
      delete next[id];
      this.deferred = next;
    },
    /** The commit's send: the toast that offered its Undo goes with it. */
    deferredSending(id) {
      if (this.toast && this.toast.key === id) {
        clearTimeout(this.toastTimer);
        this.toast = null;
      }
    },
    /** A held request was sent: the day is read again. Refused, the request comes back and the refusal is said;
     *  an accept refused for room offers to accept it anyway. */
    async deferredSettled(id, error) {
      const held = this.deferred[id];
      if (error) {
        console.warn("Restaurant request answer refused:", error.restaurant ? error.restaurant.code || error.restaurant.status : error);
      }
      if (this.unmounted) return;
      await this.reload();
      this.forgetDeferred(id);
      if (!error) return;
      const refusal = this.refusalOf(error);
      if (held && held.kind === "accept" && refusal.overridable) {
        const again = this.list.find(r => r.id === id);
        if (again) this.confirm.require({
          header: this.$t("components.restaurant.acceptAnywayTitle"),
          message: refusal.text,
          acceptLabel: this.$t("components.restaurant.bookAnyway"),
          rejectLabel: this.$t("components.restaurant.confirm.keep"),
          defaultFocus: "reject",
          accept: () => this.accept(again, true),
        });
        return;
      }
      this.showToast(refusal.text, null, true);
    },
    /** A cancellation by staff and a no-show are one tap each: the server can take both back
     *  (POST .../reinstate), so they get Undo like every other change instead of a confirmation. */
    async cancel(b) {
      if (b.state === "requested") return this.decline(b);
      const ok = await this.act(() => RestaurantApi.cancel(this.user, this.businessId, b.id, b.version), {
        done: () => this.$t("components.restaurant.cancelled", { name: b.name }),
        undo: answer => this.reinstateRun(b, answer.version, false, "cancelled"),
      });
      if (ok) this.panel = null;
    },
    noShow(b) {
      return this.act(() => RestaurantApi.noShow(this.user, this.businessId, b.id, b.version), {
        done: () => this.$t("components.restaurant.noShowDone", { name: b.name }),
        undo: answer => this.reinstateRun(b, answer.version, false, "noshow"),
      });
    },
    /** The request that takes a cancellation or a no-show back (`was`: which of the two the row is); a refusal for
     *  taken tables carries the booking, so `act` can offer to reinstate it without a table. */
    async reinstateRun(b, version, overbook, was) {
      try {
        return await RestaurantApi.reinstate(this.user, this.businessId, b.id, version, overbook);
      } catch (e) {
        e.reinstating = Object.assign({}, b, { version, was });
        throw e;
      }
    },
    /** What undoes a reinstatement: the cancellation or the no-show again, at the version it answered. */
    unreinstate(b, was, answer) {
      return was === "noshow" ? RestaurantApi.noShow(this.user, this.businessId, b.id, answer.version)
        : RestaurantApi.cancel(this.user, this.businessId, b.id, answer.version);
    },
    /** "Ripristina" on a cancelled or no-show booking the server marks `reinstatable`, with Undo. */
    reinstate(b) {
      if (!b.reinstatable) return null;
      const was = b.state;
      return this.act(() => this.reinstateRun(b, b.version, false, was), {
        done: () => this.$t("components.restaurant.reinstated", { name: b.name }),
        undo: answer => this.unreinstate(b, was, answer),
      });
    },
    /** Its tables are taken (or gone from the room): who holds each is said by name, and reinstating it with no
     *  table yet is offered explicitly, never done silently; that too can be undone. */
    askReinstateWithoutTable(b, body) {
      const tableName = id => { const t = tableById(this.layout, id); return t ? t.name : String(id); };
      const lines = (body.conflicts || []).map(c => this.$t("components.restaurant.reinstate.conflict", {
        table: tableName(c.tableId), name: c.source === "block" ? this.$t("components.restaurant.floor.blocked") : c.name || this.$t("components.restaurant.walkInName"),
        time: c.time, people: this.$t("components.restaurant.people", { n: c.covers }) }))
        .concat((body.gone || []).map(id => this.$t("components.restaurant.reinstate.gone", { table: tableName(id) })));
      this.confirm.require({
        header: this.$t("components.restaurant.reinstate.takenTitle", { name: b.name || this.$t("components.restaurant.walkInName") }),
        message: lines.join("; "),
        acceptLabel: this.$t("components.restaurant.reinstate.withoutTable"),
        rejectLabel: this.$t("components.restaurant.confirm.keep"),
        defaultFocus: "reject",
        accept: () => this.act(() => this.reinstateRun(b, b.version, true, b.was), {
          done: () => this.$t("components.restaurant.reinstate.doneWithoutTable", { name: b.name }),
          undo: answer => this.unreinstate(b, b.was, answer),
        }),
      });
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
      const ok = await this.act(() => RestaurantApi.book(this.user, this.businessId, body), {
        inPanel: true,
        done: answer => this.$t("components.restaurant.bookedDone", { name: p.name.trim(), people: this.$t("components.restaurant.people", { n: p.party }),
          day: this.shortDate(this.date), time: fmt(p.start), tables: answer && answer.tableNames && answer.tableNames.length ? answer.tableNames.join("+") : "" }),
        undo: answer => RestaurantApi.cancel(this.user, this.businessId, answer.id, answer.version),
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

    /** The server's search (POST /search: a part of the name or the number, from a week ago to sixty days
     *  ahead), asked once the typing pauses. */
    onSearch() {
      clearTimeout(this.searchTimer);
      const q = this.search.trim();
      if (q.length < 2) { this.searchResults = []; return; }
      this.searching = true;
      this.searchTimer = setTimeout(async () => {
        try {
          const found = await RestaurantApi.search(this.user, this.businessId, q.slice(0, 64), SEARCH_LIMIT);
          if (this.search.trim() !== q) return;
          // guests, requests and cancellations; never a declined request, a block or a hold
          this.searchResults = found.results.filter(r => GUEST_STATES.has(r.b.state));
          this.searchTruncated = found.truncated;
        } catch (e) {
          console.warn("Restaurant search not answered:", e.restaurant ? e.restaurant.code || e.restaurant.status : e);
          this.searchResults = [];
        } finally {
          if (this.search.trim() === q) this.searching = false;
        }
      }, 300);
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
        a.download = this.$t("components.restaurant.exportFile", { from, to });
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
