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
    <Message v-else-if="pageOff" severity="info" :closable="false" class="restaurant-page-off">
      {{ $t("components.restaurant.pageOff") }}
      <router-link v-if="skillsLink" class="ml-2" :to="skillsLink">{{ $t("components.restaurant.rules.toSkill") }}</router-link>
    </Message>
    <Message v-else-if="loadError" severity="error" :closable="false">{{ $t("components.restaurant.loadError") }}</Message>
    <Message v-else-if="manifestMissing" severity="warn" :closable="false" class="restaurant-manifest-missing">
      {{ $t("components.restaurant.manifestMissing") }}
      <Button :label="$t('components.restaurant.retry')" size="small" class="ml-2" @click="start" />
    </Message>

    <template v-else-if="ready">
      <RestaurantWizard v-if="!layout" :user="user" :business-id="businessId" :instance="instance" :rules="rules"
                        @instance-saved="loadInstance" @done="onWizardDone" />

      <template v-else>
        <div class="rb-head">
          <div class="tabs" role="tablist" :aria-label="$t('components.restaurant.sections')">
            <button role="tab" class="tab" :aria-selected="tab === 'day'" @click="setTab('day')">{{ $t("components.restaurant.tabDay") }}</button>
            <button role="tab" class="tab" :aria-selected="tab === 'room'" @click="setTab('room')">{{ $t("components.restaurant.tabRoom") }}</button>
            <button role="tab" class="tab" :aria-selected="tab === 'rules'" @click="setTab('rules')">{{ $t("components.restaurant.tabRules") }}</button>
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

        <RestaurantRoomEditor v-if="tab === 'room'" :user="user" :business-id="businessId" :layout="layout"
                              :rules="rules" :today="today" :bookings-on="bookingsOnTable" :skills-link="skillsLink"
                              @saved="onRoomSaved" @toast="showToast" @go-rules="setTab('rules')" />

        <RestaurantRulesEditor v-else-if="tab === 'rules'" :user="user" :business-id="businessId" :layout="layout" :instance="instance"
                               :rules="rules" :manifest="manifest" :skills-link="skillsLink"
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
                             :closures="day ? day.closures : []" :zones-closed="day ? day.zonesClosed : []"
                             @accept="askAccept" @decline="decline" @call="openCalls" @no-show="noShow" @make-change="makeChange" />
        </template>
      </template>
    </template>

    </div>

    <template v-if="panel">
      <div class="scrim" @click="closePanel"></div>
      <aside class="panel" :aria-label="$t('components.restaurant.panelLabel')" @keydown.esc="closePanel">
        <RestaurantBookingPanel v-if="panel.type === 'booking' && panelBooking" :booking="panelBooking" :layout="layout" :date="date"
                                :busy="busy" :change-request="changeRequestFor(panelBooking)" :on-closed-day="isOnClosedDay(panelBooking)"
                                :field-rules="rules.requiredFields" :editing="!!panel.editing" :change="panelChange" :message="panel.message"
                                @close="closePanel" @state="setState" @pin="togglePin" @no-show="noShow" @cancel="cancel" @reinstate="reinstate"
                                @move="startMove" @call="openCalls" @make-change="makeChange" @close-request="decline"
                                @edit="panel = Object.assign({}, panel, { editing: true, change: null, message: null })"
                                @cancel-edit="panel = Object.assign({}, panel, { editing: false, change: null, message: null })"
                                @save-details="saveDetails" />
        <RestaurantNewPanel v-else-if="panel.type === 'new'" :key="panel.key" :draft="panel" :message="panel.message" :layout="layout"
                            :date="date" :service="service" :win="win" :rules="rules" :list="list" :is-today="date === today" :busy="busy"
                            :find-answer="newFit" @close="closePanel" @save="saveNew" @walk-in="walkIn" @changed="askNewFit" />
        <RestaurantAcceptPanel v-else-if="panel.type === 'accept' && panelRequest" :key="panel.key" :request="panelRequest" :missing="panel.missing"
                               :busy="busy" @close="closePanel" @accept="acceptWith" />
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
import { isSessionEnded } from "@/firebase/session";
import RestaurantApi, { isMissingRoute, isPageOff, pageOffIn } from "@/utils/Restaurant";
import DeferredCommit from "@/utils/DeferredCommit";
import {
  rulesOf, missingRequired, onClosedDay, changeOf, serviceWindow, serviceAt, defaultTime, arrivalTimes, keyOf, addDays, dateOf, fmt, toMin, minuteOfDay,
  stripStatus, seatLabel, dropTargets, tableById, freeFrom, callsOf, SERVICES, GUEST_STATES
} from "@/utils/RestaurantModel";
import { shortDate, monthTitle, refusalKey, refusalPathOf, missingFieldsOf, OVERRIDABLE } from "@/components/widgets/restaurant/format";
import RestaurantStrip from "@/components/widgets/restaurant/RestaurantStrip.vue";
import RestaurantDayView from "@/components/widgets/restaurant/RestaurantDayView.vue";
import RestaurantBookingPanel from "@/components/widgets/restaurant/RestaurantBookingPanel.vue";
import RestaurantNewPanel from "@/components/widgets/restaurant/RestaurantNewPanel.vue";
import RestaurantRoomEditor from "@/components/widgets/restaurant/RestaurantRoomEditor.vue";
import RestaurantWizard from "@/components/widgets/restaurant/RestaurantWizard.vue";
import RestaurantCallModal from "@/components/widgets/restaurant/RestaurantCallModal.vue";
import RestaurantRulesEditor from "@/components/widgets/restaurant/RestaurantRulesEditor.vue";
import RestaurantAcceptPanel from "@/components/widgets/restaurant/RestaurantAcceptPanel.vue";

/** The booking a write answered, as the page goes to it: `{id, date, service}` (an apply answers `{booking, request}`). */
function bookingRowOf(answer) {
  const b = answer && answer.booking ? answer.booking : null;
  return b && b.id ? { id: b.id, date: b.date, service: b.service } : null;
}

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
  components: { RestaurantStrip, RestaurantDayView, RestaurantBookingPanel, RestaurantNewPanel, RestaurantRoomEditor, RestaurantWizard,
    RestaurantCallModal, RestaurantRulesEditor, RestaurantAcceptPanel },
  setup() {
    return { confirm: useConfirm() };
  },
  props: {
    businessId: { type: String, required: true },
    user: { type: Object, required: true },
    /** Where the skill form is (the configuration section that holds the skills), for what this page does not edit:
     *  the assistant's policy, the page switch. Null when the page cannot say. */
    skillsLink: { type: Object, default: null },
  },
  data() {
    const today = keyOf(new Date());
    return {
      today,
      ready: false,
      unavailable: false,
      noSkill: false,
      pageOff: false,
      loadError: false,
      busy: false,
      instance: null,
      tab: this.$route && this.$route.query && ["room", "rules"].includes(this.$route.query.tab) ? this.$route.query.tab : "day",
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
      manifest: null,
      manifestMissing: false,
      searchResults: [],
      searchTruncated: false,
    };
  },
  computed: {
    rules() {
      return rulesOf(this.instance ? this.instance.params : {}, this.manifest);
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
    /** What the call-back request the panel was opened from asks of its booking, pre-filling the details editor. */
    panelChange() {
      if (!this.panel || !this.panel.change || !this.panelBooking) return null;
      return changeOf(this.panelBooking, this.panel.change);
    },
    panelRequest() {
      return this.panel && this.panel.type === "accept" ? this.list.find(b => b.id === this.panel.id) || null : null;
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
    await this.start();
  },
  methods: {
    /** Reads what the page needs to draw anything: the instance, the skill's manifest, the day. Without the
     *  manifest the page has no defaults to show, so it says so and offers to read it again (`retry`). */
    async start() {
      this.loadError = false;
      try {
        await this.loadInstance();
        if (this.noSkill || this.pageOff) return;
        if (!this.manifest) { this.manifestMissing = true; return; }
        this.manifestMissing = false;
        this.service = serviceAt(this.rules, this.date, minuteOfDay(new Date()));
        await this.loadDay(this.date);
        this.resetTime();
        this.ready = !this.unavailable;
        this.loadPeriod();
      } catch (e) {
        // the session ended: the interceptor is already taking the person to sign-in, so nothing is said here
        if (isSessionEnded(e)) return;
        console.error("Restaurant page not loaded:", e.restaurant ? e.restaurant.status : e);
        this.loadError = true;
      }
    },
    fmt,
    shortDate(key) {
      return shortDate(key, this.$i18n.locale);
    },
    seatLabelOf(b) {
      return b.tables.length ? seatLabel(this.layout || { tables: [] }, b.tables) : this.$t("components.restaurant.noTable");
    },

    // ------------------------------------------------------------ reading

    async loadInstance() {
      // the manifest is asked again until it is read: a failed read is never kept as an answer
      const [instance, manifest] = await Promise.all([RestaurantApi.instance(this.user, this.businessId),
        this.manifest ? this.manifest : RestaurantApi.manifest(this.user, this.businessId)]);
      this.manifest = manifest || null;
      this.instance = instance;
      // A business that runs no restaurant skill has no book: the page says so instead of offering one.
      this.noSkill = !this.instance;
      // The skill's page switch off (R8): the staff routes answer not_configured, and the page says where to turn it on.
      this.pageOff = !!this.instance && pageOffIn(this.instance.params, this.manifest);
    },
    async loadDay(date) {
      try {
        const day = await RestaurantApi.day(this.user, this.businessId, date);
        this.days = Object.assign({}, this.days, { [date]: day });
        return day;
      } catch (e) {
        if (isSessionEnded(e)) return null;
        if (isMissingRoute(e)) this.unavailable = true;
        else if (isPageOff(e)) this.pageOff = true;
        else throw e;
        return null;
      }
    },
    /** The period strip, read a month at a time at most, from today to the horizon. */
    async loadPeriod() {
      // The book's horizon (R8), staff's: how far ahead the page opens; the assistant's `daysAhead` is shorter or equal.
      const horizon = addDays(this.today, this.rules.horizonDays);
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
        return { fits, refusal: answer.refusal, later: fits.length ? [] : answer.later, staff: answer.staff };
      } catch (e) {
        if (isSessionEnded(e)) return null;
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
    /**
     * Runs one change, reloads the day, and says what happened with Undo when the server can reverse it.
     *
     * `follow(answer)` names the booking the change is about, `{id, date, service}`: when its day is not the one shown
     * (a move to another day), the page goes to that day and opens its panel there, so the booking, and any refusal of
     * its Undo, are where the person looks. `undoAt(answer)` names the booking an Undo acts on, opened the same way
     * before the Undo is sent. `context: "undo"` says a refusal in the words of putting something back.
     */
    async act(run, { done, undo, inPanel, follow, undoAt, context } = {}) {
      if (this.busy) return null;
      this.busy = true;
      this.lastRefusal = null;
      try {
        const answer = await run();
        await this.reload();
        const target = follow ? follow(answer) : null;
        if (target) await this.openBookingOn(target);
        this.showToast(done ? done(answer) : this.$t("components.restaurant.saved"), undo ? () => undo(answer) : null, false, null, null,
          undo && undoAt ? undoAt(answer) : null);
        return answer || true;
      } catch (e) {
        if (isSessionEnded(e)) return null;
        const code = e.restaurant ? e.restaurant.code : null;
        this.lastRefusal = this.refusalOf(e, context);
        if (code === "stale") await this.reload();
        if (e.restoringAnyway) {
          this.askRestoreAnyway(e.restoringAnyway, e);
          return null;
        }
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
          this.showToast(this.lastRefusal.text, null, true);
        }
        return null;
      } finally {
        this.busy = false;
      }
    },
    refusalOf(e, context = null) {
      const body = (e.restaurant && e.restaurant.body) || {};
      const code = e.restaurant ? e.restaurant.code : null;
      const missing = missingFieldsOf(e);
      // an Undo refused: said as putting something back, where a sentence of its own exists
      const undoKey = context === "undo" && code ? `components.restaurant.undoAnswer.${code}` : null;
      if (undoKey && this.$te(undoKey)) {
        return { code, missing, text: this.$t(undoKey), overridable: false, alternatives: [] };
      }
      return {
        code, missing,
        // A missing-fields refusal names each field from the server's `values` (R8), in the owner's words.
        text: code === "missing_fields" && missing.length
          ? this.$t("components.restaurant.answer.missingFields", { fields: missing.map(f => this.$t(`components.restaurant.ask.field.${f}`)).join(", ") })
          : this.$t(refusalKey(code, refusalPathOf(e))),
        overridable: OVERRIDABLE.includes(code),
        alternatives: (body.alternatives || []).filter(a => a.date === this.date).map(a => toMin(a.time)).filter(t => t !== null),
      };
    },
    /** What staff were warned of on a write the book accepted (R8), as one sentence; empty without warnings. */
    warningsText(answer) {
      const ws = (answer && answer.warnings) || [];
      return ws.length ? " " + this.$t("components.restaurant.warning.saidOnSave", { list: ws.map(w => this.$t(`components.restaurant.warning.${w.code || w}`)).join("; ") }) : "";
    },
    /** A toast; with `undo` (a request to the server) or `localUndo` (a held write dropped) it offers Undo. */
    /** A toast; with `undo` (a request to the server) or `localUndo` (a held write dropped) it offers Undo. A
     *  toast for a held write (`key`) has no timer of its own: it goes when the write is sent. */
    showToast(text, undo = null, error = false, localUndo = null, key = null, undoAt = null) {
      clearTimeout(this.toastTimer);
      this.toast = { text, undo: undo || localUndo, server: !!undo, error, key, undoAt };
      if (!key) this.toastTimer = setTimeout(() => { this.toast = null; }, this.toast.undo ? UNDO_MS : 5000);
    },
    async undo() {
      const toast = this.toast;
      if (!toast || !toast.undo) return;
      this.toast = null;
      if (!toast.server) return toast.undo();
      // An Undo about a booking acts with that booking's panel open on its day: a refusal (and "restore anyway") is said
      // there, and the booking put back is shown where it went back to.
      if (toast.undoAt) await this.openBookingOn(toast.undoAt);
      await this.act(toast.undo, { done: () => this.$t("components.restaurant.undone"), inPanel: !!this.panel, context: "undo",
        follow: toast.undoAt ? answer => bookingRowOf(answer) : null });
    },
    /** Goes to a booking's day when it is not the one shown, and opens its panel there. */
    async openBookingOn(row) {
      if (!row || !row.id) return;
      if (row.date && row.date !== this.date) {
        if (row.service) this.service = row.service;
        await this.setDate(row.date);
      } else if (row.service && row.service !== this.service) {
        this.service = row.service;
      }
      this.panel = { type: "booking", id: row.id };
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
    defer(b, kind, run, text, guest = null) {
      this.deferred = Object.assign({}, this.deferred, { [b.id]: { kind, b, guest } });
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
    accept(b, overbook = false, guest = null) {
      this.defer(b, overbook ? "acceptAnyway" : "accept",
        () => RestaurantApi.accept(this.user, this.businessId, b.id, Object.assign({ expectedVersion: b.version, overbook: overbook || undefined }, guest || {})),
        this.$t("components.restaurant.acceptedDone", { name: (guest && guest.name) || b.name }), guest);
    },
    /**
     * "Accept" on a request: one that lacks a field this restaurant requires (a request may come without them) asks
     * for it first, and the accept carries it in the same call (R8); one that has them is accepted as before.
     * Accepting needs no zone: the request already has one.
     */
    askAccept(b) {
      const missing = missingRequired(this.rules.requiredFields, b, ["name", "phone", "allergies", "notes"]);
      if (missing.length) {
        this.panel = { type: "accept", id: b.id, key: Date.now(), missing };
        return;
      }
      this.accept(b);
    },
    acceptWith({ request, guest }) {
      this.panel = null;
      this.accept(request, false, guest);
    },
    /** The call-back request about a change of a booking (R8), when the day read holds one naming it. */
    /** The open call-back request about this booking: its row when the day read holds it, otherwise the one the booking
     *  row carries (`openRequest`, R8: filed for another day), which has all staff act on (version, day, what was asked). */
    changeRequestFor(b) {
      if (!b) return null;
      const here = this.list.find(r => r.state === "requested" && r.about === b.id);
      if (here) return here;
      const o = b.openRequest;
      if (!o) return null;
      const c = o.change || {};
      return { id: o.id, version: o.version, date: o.date, about: b.id, state: "requested", remote: true, at: o.at,
        name: c.name || b.name, start: c.start !== undefined ? c.start : b.start, party: c.party || b.party, notes: c.notes || "",
        change: o.change || (o.kind ? { kind: o.kind } : null) };
    },
    isOnClosedDay(b) {
      return !!(b && this.day && ["booked", "arrived", "seated"].includes(b.state) && onClosedDay(b, this.day.closures, this.day.zonesClosed));
    },
    /**
     * "Make the change" on a call-back request about a booking: the booking opens with its details editor pre-filled
     * from what the caller asked (`change`, classified by the book: a move ticked, a late arrival in the notes, the
     * details), staff check it and save once; the save changes the booking at the version read and closes the request.
     * A cancellation asked by phone cancels the booking and closes the request, with Undo. Accepting such a request
     * would make a second booking, so the server refuses it (`linked_request`) and the page never offers it.
     * The booking is found wherever it is: the request names its day (`aboutReservation`), and the page goes there.
     */
    async makeChange(request) {
      if (this.busy || !request || !request.about) return;
      const asked = Object.assign({}, request, { date: request.date || this.date });
      let original = this.list.find(b => b.id === request.about);
      const where = request.aboutReservation;
      if (!original && where && where.date && where.date !== this.date) {
        await this.setDate(where.date);
        original = this.list.find(b => b.id === request.about);
        if (original) this.setService(original.service);
      }
      if (!original) { this.showToast(this.$t("components.restaurant.change.notFound"), null, true); return; }
      if (asked.change && asked.change.kind === "cancellation") return this.cancelAsked(original, asked);
      this.panel = { type: "booking", id: original.id, editing: true, change: asked, message: null };
    },
    /** A cancellation asked by phone of a booking the caller could not cancel themselves: the request is applied (the
     *  booking cancelled and the request closed in one transaction); Undo takes the booking back (the request stays
     *  closed). */
    cancelAsked(original, request) {
      return this.act(() => RestaurantApi.applyRequest(this.user, this.businessId, request.id, request.version, original.version, {}), {
        done: () => this.$t("components.restaurant.change.cancelled", { name: original.name || this.$t("components.restaurant.walkInName") }),
        undo: answer => this.unapply(answer),
        undoAt: answer => bookingRowOf(answer),
      });
    },
    /** Undo of an applied request: the book puts the booking back (or reinstates it) and reopens the request, in one
     *  transaction, so the caller's request is back in the inbox for staff to act on. */
    async unapply(answer, overbook = false) {
      try {
        return await RestaurantApi.unapplyRequest(this.user, this.businessId, answer.request.id, answer.request.version,
          answer.booking.version, overbook);
      } catch (e) {
        // its tables taken, or no room: "restore anyway" puts it back with no table, as "book anyway" books one
        if (!overbook && e.restaurant && ["full", "table_taken"].includes(e.restaurant.code)) e.restoringAnyway = answer;
        throw e;
      }
    },
    /** A refused Undo of an apply that may be put back with no table: said on the booking's card, with "restore anyway". */
    askRestoreAnyway(answer, e) {
      const refusal = this.refusalOf(e, "undo");
      this.panel = { type: "booking", id: answer.booking.id, message: Object.assign(refusal, {
        retryLabel: this.$t("components.restaurant.change.restoreAnyway"),
        retry: () => this.act(() => this.unapply(answer, true), { done: () => this.$t("components.restaurant.undone"), inPanel: true,
          context: "undo", follow: a => bookingRowOf(a) }),
      }) };
    },
    /**
     * Saves the details editor. Staff's own edit is one change of the booking at the version read (the details that
     * changed, an emptied one as "", which the book reads as cleared). From a call-back request it is the request
     * applied (`applyRequest`): the book does what the request asks by its kind and closes it in the same transaction;
     * what staff changed in the editor goes as their values over the asked ones. Undo puts back what was there.
     */
    async saveDetails({ guest, overbook }) {
      const b = this.panelBooking;
      if (!b) return;
      const request = this.panel.change;
      // Undo of staff's own edit writes back the previous values: a field that was empty goes back to empty (sent as "",
      // which the book reads as cleared) unless the restaurant now requires it, which the book would refuse to clear.
      // Undo of an applied request is the book's own reverse (`unapply`).
      const back = {};
      Object.keys(guest).forEach(k => {
        if (String(b[k] || "").trim()) back[k] = b[k];
        else if (this.rules.requiredFields[k] !== "required") back[k] = "";
      });
      const ok = await this.act(async () => {
        if (!request) return RestaurantApi.change(this.user, this.businessId, b.id, Object.assign({ expectedVersion: b.version }, guest));
        // "book anyway" after `full`: the same overrides again, overbooked (the booking keeps no table yet)
        return RestaurantApi.applyRequest(this.user, this.businessId, request.id, request.version, b.version,
          overbook ? Object.assign({}, guest, { overbook: true }) : guest);
      }, {
        inPanel: true,
        done: answer => (request
          ? this.$t("components.restaurant.change.applied", { name: b.name || this.$t("components.restaurant.walkInName") }) + this.warningsText(answer.booking)
          : this.$t("components.restaurant.details.saved", { name: guest.name || b.name || this.$t("components.restaurant.walkInName") }) + this.warningsText(answer)),
        // the booking where it now is: a move to another day goes there, its panel open
        follow: answer => (request ? bookingRowOf(answer) : bookingRowOf({ booking: answer })),
        undoAt: answer => (request ? bookingRowOf(answer) : bookingRowOf({ booking: answer })),
        undo: request ? answer => this.unapply(answer)
          : Object.keys(back).length ? answer => RestaurantApi.change(this.user, this.businessId, b.id, Object.assign({ expectedVersion: answer.version }, back)) : null,
      });
      if (ok && this.panel && this.panel.type === "booking") this.panel = Object.assign({}, this.panel, { editing: false, change: null, message: null });
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
      if (error && isSessionEnded(error)) return;
      if (error) {
        console.warn("Restaurant request answer refused:", error.restaurant ? error.restaurant.code || error.restaurant.status : error);
      }
      if (this.unmounted) return;
      await this.reload();
      this.forgetDeferred(id);
      if (!error) return;
      const refusal = this.refusalOf(error);
      // Accepted without a field this restaurant requires: the fields named by the server are asked, and the accept
      // goes again with them.
      if (held && refusal.code === "missing_fields" && refusal.missing.length) {
        const again = this.list.find(r => r.id === id);
        if (again) { this.panel = { type: "accept", id, key: Date.now(), missing: refusal.missing }; return; }
      }
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
      return this.moveWarned(b, () => this.act(() => RestaurantApi.change(this.user, this.businessId, b.id, { expectedVersion: b.version, tableIds: to }), {
        done: answer => this.$t("components.restaurant.movedTo", { name: b.name, tables: seatLabel(this.layout, to) }) + this.warningsText(answer),
        undo: answer => RestaurantApi.change(this.user, this.businessId, b.id,
          { expectedVersion: answer.version, tableIds: from.length ? from : undefined, time: fmt(b.start) }),
      }));
    },
    /**
     * A move staff make by dragging or tapping a table: what the book warns staff of for that party then (R8: hours,
     * grid, notice, the assistant's largest party, pace) is asked first, as the booking form asks it, and said before
     * the move is made, with "move anyway"; with nothing to say the move is made at once.
     */
    async moveWarned(b, run) {
      const pre = await this.askWhere(this.date, b.start, b.party);
      const warnings = pre && pre.staff && !pre.staff.refusal ? pre.staff.warnings || [] : [];
      if (!warnings.length) return run();
      this.confirm.require({
        header: this.$t("components.restaurant.move.warnTitle", { name: b.name || this.$t("components.restaurant.walkInName") }),
        message: warnings.map(w => this.$t(`components.restaurant.warning.${w}`)).join(" "),
        acceptLabel: this.$t("components.restaurant.move.anyway"),
        rejectLabel: this.$t("components.restaurant.confirm.keep"),
        defaultFocus: "reject",
        accept: () => run(),
      });
      return null;
    },
    newBody(p, overbook) {
      return {
        date: this.date, time: fmt(p.start), covers: p.party, name: p.name.trim() || undefined, phone: p.phone.trim() || undefined,
        notes: p.notes.trim() || undefined, allergies: p.allergies.trim() || undefined, tableIds: p.tables || undefined,
        zone: (!p.tables && p.zone) || undefined,
        overbook: overbook || undefined,
      };
    },
    async saveNew({ form, overbook }) {
      const p = form;
      const body = this.newBody(p, overbook);
      const ok = await this.act(() => RestaurantApi.book(this.user, this.businessId, body), {
        inPanel: true,
        done: answer => this.$t("components.restaurant.bookedDone", { name: p.name.trim(), people: this.$t("components.restaurant.people", { n: p.party }),
          day: this.shortDate(this.date), time: fmt(p.start), tables: answer && answer.tableNames && answer.tableNames.length ? answer.tableNames.join("+") : "" }) +
          this.warningsText(answer),
        undo: answer => RestaurantApi.cancel(this.user, this.businessId, answer.id, answer.version),
      });
      if (ok) this.panel = null;
    },
    /** A walk-in, now: the tables staff chose stay chosen (the server judges them), the area when there is no table, and
     *  the fields this restaurant requires of a walk-in (allergies, notes; never name or phone, R8). */
    async walkIn({ form, party }) {
      const p = form;
      const now = minuteOfDay(new Date());
      const body = { date: this.date, time: fmt(now), covers: party, walkIn: true, tableIds: p.tables || undefined,
        zone: (!p.tables && p.zone) || undefined, allergies: (p.allergies || "").trim() || undefined, notes: (p.notes || "").trim() || undefined };
      const ok = await this.act(() => RestaurantApi.book(this.user, this.businessId, body), {
        inPanel: true,
        done: answer => this.$t("components.restaurant.walkInDone", { party,
          tables: answer && answer.tableNames && answer.tableNames.length ? answer.tableNames.join("+") : "" }) + this.warningsText(answer),
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
          if (isSessionEnded(e)) return;
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
        if (isSessionEnded(e)) return;
        this.showToast(this.$t(refusalKey(e.restaurant ? e.restaurant.code : null)), null, true);
      }
    },
  },
};
</script>

<style lang="less">
@import "./restaurant/restaurant.less";
</style>
