<template>
  <div class="restaurant">
    <Message v-if="unavailable" severity="info" :closable="false" class="restaurant-unavailable">
      {{ $t("components.restaurant.unavailable") }}
    </Message>
    <Message v-else-if="noSkill" severity="info" :closable="false" class="restaurant-unavailable">
      {{ $t("components.restaurant.noSkill") }}
    </Message>
    <Message v-else-if="loadError" severity="error" :closable="false">{{ $t("components.restaurant.loadError") }}</Message>

    <template v-if="!unavailable && !noSkill">
      <div class="restaurant-day-picker">
        <SelectButton v-model="dayChoice" :options="dayOptions" optionLabel="label" optionValue="value" :allowEmpty="false"
                      :aria-label="$t('components.restaurant.day')" />
        <InputText v-model="date" type="date" class="restaurant-date" :aria-label="$t('components.restaurant.day')" />
      </div>

      <Message v-if="message" :severity="message.severity" :closable="false" class="restaurant-message">
        {{ message.text }}
        <Button v-if="message.overbook" :label="$t('components.restaurant.bookAnyway')" size="small" severity="warn"
                class="restaurant-overbook" @click="message.overbook()" />
      </Message>

      <template v-if="info">
        <Message v-if="!info.configured" severity="warn" :closable="false">{{ $t("components.restaurant.notConfigured") }}</Message>

        <!-- per service: the slots, with what arrives and what is in use against the room and the assistant's line -->
        <section v-for="service in services" :key="service.name" class="restaurant-service">
          <div class="restaurant-service-head">
            <h3>{{ $t(`components.restaurant.service.${service.name}`) }}</h3>
            <span class="restaurant-covers">{{ $t("components.restaurant.coversBooked", { covers: (info.covers || {})[service.name] || 0 }) }}</span>
            <Button :label="$t('components.restaurant.stopSell')" icon="pi pi-ban" size="small" severity="secondary"
                    :disabled="busy" @click="stopSell(service.name)" />
          </div>
          <div class="restaurant-slots">
            <div v-for="slot in service.slots" :key="slot.time" class="restaurant-slot">
              <span class="restaurant-slot-time">{{ slot.time }}</span>
              <span class="restaurant-slot-arriving" :title="$t('components.restaurant.arriving')">
                {{ $t("components.restaurant.arrivingCovers", { covers: slot.arriving }) }}
              </span>
              <span v-for="area in slot.areas" :key="area.area" class="restaurant-slot-area">
                <strong>{{ $t(`components.restaurant.area.${area.area}`) }}</strong>
                <template v-if="area.tables && area.tables.length">
                  <Tag v-for="t in area.tables" :key="t.size" :severity="severityOf(t.used, t.assistantLimit, t.count)"
                       class="restaurant-table-use" :data-state="stateOf(t.used, t.assistantLimit, t.count)">
                    {{ $t("components.restaurant.tableUse", { size: t.size, used: t.used, count: t.count }) }}
                  </Tag>
                </template>
                <Tag v-else :severity="severityOf(area.seatsUsed, area.assistantSeats, area.seats)" class="restaurant-seat-use"
                     :data-state="stateOf(area.seatsUsed, area.assistantSeats, area.seats)">
                  {{ $t("components.restaurant.seatUse", { used: area.seatsUsed, seats: area.seats }) }}
                </Tag>
              </span>
            </div>
          </div>
        </section>
        <p class="restaurant-legend">{{ $t("components.restaurant.legend") }}</p>

        <!-- requests a person decides on -->
        <section v-if="requests.length" class="restaurant-requests">
          <h3>{{ $t("components.restaurant.requests") }}</h3>
          <div v-for="r in requests" :key="r.id" class="restaurant-row restaurant-request">
            <span>{{ r.time }} · {{ $t("components.restaurant.people", { covers: r.covers }) }} · {{ r.name || "" }} {{ r.phone || "" }}</span>
            <span v-if="r.requestReason" class="restaurant-reason">{{ $t(`components.restaurant.reason.${r.requestReason}`) }}</span>
            <span v-if="r.notes" class="restaurant-notes">{{ r.notes }}</span>
            <Button :label="$t('components.restaurant.accept')" icon="pi pi-check" size="small" :disabled="busy" @click="accept(r)" />
            <Button :label="$t('components.restaurant.decline')" icon="pi pi-times" size="small" severity="secondary"
                    :disabled="busy" @click="cancel(r)" />
          </div>
        </section>

        <!-- the bookings of the day -->
        <section class="restaurant-bookings">
          <h3>{{ $t("components.restaurant.bookings") }}</h3>
          <p v-if="!bookings.length" class="restaurant-empty">{{ $t("components.restaurant.noBookings") }}</p>
          <div v-for="r in bookings" :key="r.id" class="restaurant-row restaurant-booking" :data-status="r.status">
            <span class="restaurant-booking-time">{{ r.time }}</span>
            <span>{{ $t("components.restaurant.people", { covers: r.covers }) }}</span>
            <span>{{ $t(`components.restaurant.area.${r.area}`) }}</span>
            <span v-if="r.tableSize" class="restaurant-booking-table">
              {{ $t("components.restaurant.tableOf", { size: r.tableSize, tables: r.tables || 1 }) }}
            </span>
            <span>{{ r.name || "" }} {{ r.phone || "" }}</span>
            <span v-if="r.allergies" class="restaurant-allergies">{{ $t("components.restaurant.allergies") }}: {{ r.allergies }}</span>
            <span v-if="r.notes" class="restaurant-notes">{{ r.notes }}</span>
            <Tag v-if="r.status === 'no_show'" severity="danger">{{ $t("components.restaurant.status.no_show") }}</Tag>
            <Tag v-else-if="r.status === 'cancelled'" severity="secondary">{{ $t("components.restaurant.status.cancelled") }}</Tag>
            <Tag v-if="r.overbooked" severity="warn">{{ $t("components.restaurant.overbooked") }}</Tag>
            <template v-if="r.status === 'confirmed'">
              <Button :label="$t('components.restaurant.move')" icon="pi pi-pencil" size="small" severity="secondary"
                      :disabled="busy" @click="openMove(r)" />
              <Button :label="$t('components.restaurant.noShow')" size="small" severity="secondary" :disabled="busy" @click="noShow(r)" />
              <Button :label="$t('components.restaurant.cancel')" icon="pi pi-trash" size="small" severity="danger" text
                      :disabled="busy" @click="cancel(r)" />
            </template>
          </div>
        </section>

        <!-- blocks and stopped services, each undone by removing it -->
        <section v-if="blocks.length" class="restaurant-blocks">
          <h3>{{ $t("components.restaurant.blocks") }}</h3>
          <div v-for="b in blocks" :key="b.id" class="restaurant-row restaurant-block">
            <span>{{ $t(`components.restaurant.service.${b.service}`) }} · {{ $t(`components.restaurant.area.${b.area}`) }}</span>
            <span v-if="b.tableSize">{{ $t("components.restaurant.tableOf", { size: b.tableSize, tables: b.tables || 1 }) }}</span>
            <span v-else>{{ $t("components.restaurant.people", { covers: b.covers }) }}</span>
            <Button :label="$t('components.restaurant.removeBlock')" size="small" severity="secondary" :disabled="busy" @click="cancel(b)" />
          </div>
        </section>

        <!-- a booking taken by phone or at the door -->
        <section class="restaurant-new">
          <h3>{{ $t("components.restaurant.newBooking") }}</h3>
          <div class="restaurant-form">
            <label>{{ $t("components.restaurant.time") }}<InputText v-model="form.time" type="time" /></label>
            <label>{{ $t("components.restaurant.covers") }}<InputNumber v-model="form.covers" :min="1" :max="200" :useGrouping="false" /></label>
            <label>{{ $t("components.restaurant.name") }}<InputText v-model="form.name" /></label>
            <label>{{ $t("components.restaurant.phone") }}<InputText v-model="form.phone" type="tel" /></label>
            <label>{{ $t("components.restaurant.areaLabel") }}
              <Dropdown v-model="form.area" :options="areaOptions" optionLabel="label" optionValue="value" showClear />
            </label>
            <label v-if="sizeOptions.length">{{ $t("components.restaurant.tableSize") }}
              <Dropdown v-model="form.tableSize" :options="sizeOptions" optionLabel="label" optionValue="value" showClear />
            </label>
            <label v-if="form.tableSize">{{ $t("components.restaurant.tables") }}<InputNumber v-model="form.tables" :min="1" :max="200" :useGrouping="false" /></label>
            <label class="restaurant-form-wide">{{ $t("components.restaurant.notes") }}<InputText v-model="form.notes" /></label>
          </div>
          <Button :label="$t('components.restaurant.book')" icon="pi pi-plus" :disabled="busy || !form.time || !form.covers" @click="book(false)" />
        </section>

        <!-- seats or tables taken out of the book for a service -->
        <section class="restaurant-new-block">
          <h3>{{ $t("components.restaurant.newBlock") }}</h3>
          <div class="restaurant-form">
            <label>{{ $t("components.restaurant.serviceLabel") }}
              <Dropdown v-model="blockForm.service" :options="serviceOptions" optionLabel="label" optionValue="value" />
            </label>
            <label>{{ $t("components.restaurant.areaLabel") }}
              <Dropdown v-model="blockForm.area" :options="areaOptions" optionLabel="label" optionValue="value" />
            </label>
            <label v-if="blockSizes.length">{{ $t("components.restaurant.tableSize") }}
              <Dropdown v-model="blockForm.tableSize" :options="blockSizes" optionLabel="label" optionValue="value" />
            </label>
            <label v-if="blockSizes.length">{{ $t("components.restaurant.tables") }}<InputNumber v-model="blockForm.tables" :min="1" :max="200" :useGrouping="false" /></label>
            <label v-else>{{ $t("components.restaurant.covers") }}<InputNumber v-model="blockForm.covers" :min="1" :max="500" :useGrouping="false" /></label>
            <label class="restaurant-form-wide">{{ $t("components.restaurant.notes") }}<InputText v-model="blockForm.note" /></label>
          </div>
          <Button :label="$t('components.restaurant.block')" icon="pi pi-lock" severity="secondary" :disabled="busy || !blockComplete" @click="addBlock" />
        </section>
      </template>

      <!-- the room: tables per area, the rule for a small party, the assistant's share -->
      <section v-if="settings" class="restaurant-settings">
        <h3>{{ $t("components.restaurant.settings") }}</h3>
        <p class="restaurant-help">{{ $t("components.restaurant.settingsHelp") }}</p>
        <div v-for="area in ['indoor', 'outdoor']" :key="area" class="restaurant-settings-area" :data-area="area">
          <h4>{{ $t(`components.restaurant.area.${area}`) }}</h4>
          <div v-for="(t, i) in settings.tables[area]" :key="i" class="restaurant-table-type">
            <label>{{ $t("components.restaurant.tableSize") }}<InputNumber v-model="t.size" :min="1" :max="30" :useGrouping="false" /></label>
            <label>{{ $t("components.restaurant.tableCount") }}<InputNumber v-model="t.count" :min="0" :max="200" :useGrouping="false" /></label>
            <label>{{ $t("components.restaurant.minParty") }}<InputNumber v-model="t.minParty" :min="1" :max="30" :useGrouping="false" /></label>
            <Button icon="pi pi-trash" text severity="danger" :aria-label="$t('components.restaurant.removeTable')" @click="settings.tables[area].splice(i, 1)" />
          </div>
          <Button :label="$t('components.restaurant.addTable')" icon="pi pi-plus" size="small" text @click="addTableType(area)" />
          <label v-if="!settings.tables[area].length" class="restaurant-seats">
            {{ $t("components.restaurant.seats") }}<InputNumber v-model="settings.seats[area]" :min="0" :max="2000" :useGrouping="false" />
          </label>
        </div>
        <label>{{ $t("components.restaurant.policy") }}
          <Dropdown v-model="settings.policy" :options="policyOptions" optionLabel="label" optionValue="value" />
        </label>
        <label v-if="settings.policy === 'close_to_service'">{{ $t("components.restaurant.relaxMinutes") }}
          <InputNumber v-model="settings.relaxMinutes" :min="0" :max="1440" :useGrouping="false" />
        </label>
        <label>{{ $t("components.restaurant.assistantShare") }}
          <InputNumber v-model="settings.share" :min="50" :max="100" suffix="%" :useGrouping="false" />
        </label>
        <p class="restaurant-help">{{ $t("components.restaurant.assistantShareHelp") }}</p>
        <Message v-if="settingsMessage" :severity="settingsMessage.severity" :closable="false">{{ settingsMessage.text }}</Message>
        <Button :label="$t('components.restaurant.saveSettings')" icon="pi pi-check" :loading="saving" @click="saveSettings" />
      </section>
    </template>

    <Dialog v-model:visible="moving.visible" modal :header="$t('components.restaurant.move')" class="restaurant-move-dialog">
      <div class="restaurant-form">
        <label>{{ $t("components.restaurant.time") }}<InputText v-model="moving.time" type="time" /></label>
        <label>{{ $t("components.restaurant.covers") }}<InputNumber v-model="moving.covers" :min="1" :max="200" :useGrouping="false" /></label>
        <label>{{ $t("components.restaurant.areaLabel") }}
          <Dropdown v-model="moving.area" :options="areaOptions" optionLabel="label" optionValue="value" />
        </label>
        <label v-if="sizeOptions.length">{{ $t("components.restaurant.tableSize") }}
          <Dropdown v-model="moving.tableSize" :options="sizeOptions" optionLabel="label" optionValue="value" showClear />
        </label>
        <label v-if="moving.tableSize">{{ $t("components.restaurant.tables") }}<InputNumber v-model="moving.tables" :min="1" :max="200" :useGrouping="false" /></label>
      </div>
      <template #footer>
        <Button :label="$t('components.restaurant.close')" severity="secondary" text @click="moving.visible = false" />
        <Button :label="$t('components.restaurant.save')" icon="pi pi-check" :disabled="busy" @click="move(false)" />
      </template>
    </Dialog>
  </div>
</template>

<script>
import RestaurantApi from "@/utils/Restaurant";

const KNOWN_CODES = ["full", "closed", "not_offered", "too_late", "beyond_horizon", "large_party", "bad_covers", "stale",
  "busy_retry", "idempotency_key_reused", "not_found", "not_configured"];
const SETTINGS_CODES = ["out_of_range", "share_below_party", "duplicate_size", "bad_table", "party_larger_than_room", "no_seats",
  "pace_below_party", "unknown_policy"];

function isoDay(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The restaurateur's page for the book the assistant writes into: today and tomorrow (or any day) by
 * service, each arrival slot with the covers arriving and the seats or tables in use against the room
 * and against the share the assistant may sell; requests to accept or decline; bookings to add, move,
 * cancel or mark as no-show; blocks and stopped services, undone by removing them; and the room itself
 * (tables per area, the rule for a small party at a big table, the assistant's share), saved to the
 * restaurant_booking instance at the revision read. StarChat decides everything; the page shows its
 * answers in the owner's language and never the server's English. Without the restaurant routes on the
 * server (404) the page says so and offers nothing.
 */
export default {
  props: {
    businessId: { type: String, required: true },
    user: { type: Object, required: true },
  },
  data() {
    return {
      date: isoDay(0),
      info: null,
      unavailable: false,
      noSkill: false,
      loadError: false,
      busy: false,
      message: null,
      form: { time: "", covers: 2, name: "", phone: "", area: null, tableSize: null, tables: 1, notes: "" },
      blockForm: { service: "dinner", area: "indoor", covers: null, tableSize: null, tables: 1, note: "" },
      moving: { visible: false, row: null, time: "", covers: 2, area: "indoor", tableSize: null, tables: 1 },
      instance: null,
      settings: null,
      settingsMessage: null,
      saving: false,
    };
  },
  computed: {
    dayChoice: {
      get() {
        return this.date === isoDay(0) ? "today" : this.date === isoDay(1) ? "tomorrow" : null;
      },
      set(value) {
        this.date = value === "tomorrow" ? isoDay(1) : isoDay(0);
      },
    },
    dayOptions() {
      return [
        { value: "today", label: this.$t("components.restaurant.today") },
        { value: "tomorrow", label: this.$t("components.restaurant.tomorrow") },
      ];
    },
    rows() {
      return (this.info && this.info.reservations) || [];
    },
    requests() {
      return this.rows.filter(r => r.status === "requested");
    },
    bookings() {
      return this.rows.filter(r => r.source !== "block" && ["confirmed", "no_show"].includes(r.status))
        .sort((a, b) => a.time.localeCompare(b.time));
    },
    blocks() {
      return this.rows.filter(r => r.source === "block" && r.status === "confirmed");
    },
    services() {
      const occupancy = (this.info && this.info.occupancy) || {};
      return ["lunch", "dinner"].filter(s => occupancy[s]).map(s => ({ name: s, slots: occupancy[s] }));
    },
    areaOptions() {
      return ["indoor", "outdoor"].map(a => ({ value: a, label: this.$t(`components.restaurant.area.${a}`) }));
    },
    serviceOptions() {
      return ["lunch", "dinner"].map(s => ({ value: s, label: this.$t(`components.restaurant.service.${s}`) }));
    },
    policyOptions() {
      return ["refuse", "accept", "close_to_service"].map(p => ({ value: p, label: this.$t(`components.restaurant.policies.${p}`) }));
    },
    sizeOptions() {
      const tables = (this.info && this.info.tables) || {};
      const sizes = new Set();
      Object.values(tables).forEach(list => (list || []).forEach(t => sizes.add(t.size)));
      return [...sizes].sort((a, b) => a - b).map(s => ({ value: s, label: this.$t("components.restaurant.seatsAtTable", { size: s }) }));
    },
    blockSizes() {
      const list = ((this.info && this.info.tables) || {})[this.blockForm.area] || [];
      return list.map(t => ({ value: t.size, label: this.$t("components.restaurant.seatsAtTable", { size: t.size }) }));
    },
    blockComplete() {
      return this.blockSizes.length ? !!this.blockForm.tableSize && this.blockForm.tables > 0 : this.blockForm.covers > 0;
    },
  },
  watch: {
    date() {
      this.load();
    },
  },
  async mounted() {
    await Promise.all([this.load(), this.loadSettings()]);
  },
  methods: {
    async load() {
      this.loadError = false;
      try {
        this.info = await RestaurantApi.day(this.user, this.businessId, this.date);
      } catch (e) {
        if (e.restaurant && e.restaurant.status === 404 && !e.restaurant.code) {
          this.unavailable = true;
        } else {
          console.error("Restaurant book not loaded:", e.restaurant ? e.restaurant.status : e);
          this.loadError = true;
        }
      }
    },
    async loadSettings() {
      try {
        this.instance = await RestaurantApi.instance(this.user, this.businessId);
        // A business that runs no restaurant skill has no book: the page says so instead of offering one.
        this.noSkill = !this.instance;
      } catch (e) {
        console.error("Restaurant settings not loaded:", e.restaurant ? e.restaurant.status : e);
        this.instance = null;
      }
      this.settings = this.instance ? this.settingsOf(this.instance.params) : null;
    },
    settingsOf(params) {
      let tables = {};
      try {
        tables = typeof params.tables === "string" && params.tables.trim() ? JSON.parse(params.tables) : (params.tables || {});
      } catch {
        tables = {};
      }
      const list = area => (Array.isArray(tables[area]) ? tables[area] : [])
        .map(t => ({ size: t.size, count: t.count, minParty: t.minParty ?? (t.size <= 2 ? 1 : t.size - 1) }));
      const number = (v, fallback) => (v === undefined || v === null || String(v).trim() === "" ? fallback : Number(v));
      return {
        tables: { indoor: list("indoor"), outdoor: list("outdoor") },
        seats: { indoor: number(params.indoorSeats, 0), outdoor: number(params.outdoorSeats, 0) },
        policy: params.smallPartyPolicy || "refuse",
        relaxMinutes: number(params.relaxMinutes, 60),
        share: number(params.assistantShare, 100),
      };
    },
    addTableType(area) {
      this.settings.tables[area].push({ size: 4, count: 1, minParty: 3 });
    },
    severityOf(used, limit, total) {
      const state = this.stateOf(used, limit, total);
      return state === "over" ? "danger" : state === "staff" ? "warn" : "success";
    },
    /** free: the assistant may still sell here; staff: only staff may; over: more than the room holds. */
    stateOf(used, limit, total) {
      if (used > total) return "over";
      if (used >= limit) return "staff";
      return "free";
    },
    say(severity, key, params) {
      this.message = { severity, text: this.$t(key, params || {}) };
    },
    /** The server's answer as a sentence in the owner's language, never its English. */
    refusal(e, retry) {
      const code = e.restaurant ? e.restaurant.code : null;
      const known = KNOWN_CODES.includes(code) ? code : "error";
      this.message = { severity: known === "error" ? "error" : "warn", text: this.$t(`components.restaurant.answer.${known}`) };
      if (retry && ["full", "not_offered", "too_late", "large_party", "closed"].includes(code)) this.message.overbook = retry;
      if (code === "stale") this.load();
    },
    async run(action, done, retry) {
      this.busy = true;
      this.message = null;
      try {
        await action();
        if (done) this.say("success", done);
        await this.load();
      } catch (e) {
        this.refusal(e, retry);
      } finally {
        this.busy = false;
      }
    },
    choice(source) {
      return source.tableSize ? { tableSize: source.tableSize, tables: source.tables || 1 } : {};
    },
    book(overbook) {
      const body = Object.assign({
        date: this.date, time: this.form.time, covers: this.form.covers, name: this.form.name || undefined,
        phone: this.form.phone || undefined, notes: this.form.notes || undefined, area: this.form.area || undefined,
        overbook: overbook || undefined,
      }, this.choice(this.form));
      return this.run(async () => {
        await RestaurantApi.book(this.user, this.businessId, body);
        this.form = { time: "", covers: 2, name: "", phone: "", area: null, tableSize: null, tables: 1, notes: "" };
      }, "components.restaurant.booked", overbook ? null : () => this.book(true));
    },
    openMove(r) {
      // A move decides the table again: a party at one table is sent with no size, so the book gives it the
      // smallest free one at the new time (pre-filling the row's size had a move refused as full where
      // that size was taken and a smaller one was free). A party on several tables keeps them, since
      // without a choice a group above the party limit is refused. Staff can still pick a size here.
      const several = (r.tables || 1) > 1 && !!r.tableSize;
      this.moving = { visible: true, row: r, time: r.time, covers: r.covers, area: r.area,
        tableSize: several ? r.tableSize : null, tables: several ? r.tables : 1 };
    },
    move(overbook) {
      const r = this.moving.row;
      const body = Object.assign({ expectedVersion: r.version, time: this.moving.time, covers: this.moving.covers,
        area: this.moving.area, overbook: overbook || undefined }, this.choice(this.moving));
      this.moving.visible = false;
      return this.run(() => RestaurantApi.change(this.user, this.businessId, r.id, body), "components.restaurant.moved",
        overbook ? null : () => { this.moving.visible = false; return this.move(true); });
    },
    cancel(r) {
      return this.run(() => RestaurantApi.cancel(this.user, this.businessId, r.id, r.version), "components.restaurant.cancelled");
    },
    noShow(r) {
      return this.run(() => RestaurantApi.noShow(this.user, this.businessId, r.id, r.version), "components.restaurant.noShowRecorded");
    },
    accept(r, overbook) {
      return this.run(() => RestaurantApi.accept(this.user, this.businessId, r.id,
        { expectedVersion: r.version, overbook: overbook || undefined }), "components.restaurant.accepted",
        overbook ? null : () => this.accept(r, true));
    },
    stopSell(service) {
      return this.run(() => RestaurantApi.stopSell(this.user, this.businessId, this.date, service), "components.restaurant.stopped");
    },
    addBlock() {
      const f = this.blockForm;
      const body = { date: this.date, service: f.service, area: f.area, note: f.note || undefined };
      if (this.blockSizes.length) Object.assign(body, { tableSize: f.tableSize, tables: f.tables });
      else body.covers = f.covers;
      return this.run(() => RestaurantApi.block(this.user, this.businessId, body), "components.restaurant.blocked");
    },
    async saveSettings() {
      this.settingsMessage = null;
      const s = this.settings;
      // A row whose size was cleared is not dropped in silence: the owner fills it in or removes the row.
      const sizeless = ["indoor", "outdoor"].some(area => s.tables[area].some(t => !(t.size > 0)));
      if (sizeless) {
        this.settingsMessage = { severity: "error", text: this.$t("components.restaurant.tableWithoutSize") };
        return;
      }
      this.saving = true;
      const tables = {};
      ["indoor", "outdoor"].forEach(area => {
        const list = s.tables[area].map(t => ({ size: t.size, count: t.count || 0, minParty: t.minParty }));
        if (list.length) tables[area] = list;
      });
      const params = Object.assign({}, this.instance.params, {
        tables: Object.keys(tables).length ? JSON.stringify(tables) : "",
        indoorSeats: String(s.seats.indoor ?? 0),
        outdoorSeats: String(s.seats.outdoor ?? 0),
        smallPartyPolicy: s.policy,
        relaxMinutes: String(s.relaxMinutes ?? 60),
        assistantShare: String(s.share ?? 100),
      });
      try {
        await RestaurantApi.saveInstance(this.user, this.businessId, this.instance, params);
        await this.loadSettings();
        await this.load();
        this.settingsMessage = { severity: "success", text: this.$t("components.restaurant.settingsSaved") };
      } catch (e) {
        const status = e.restaurant ? e.restaurant.status : null;
        if (status === 409) {
          await this.loadSettings();
          this.settingsMessage = { severity: "warn", text: this.$t("components.restaurant.changedMeanwhile") };
        } else if (status === 422) {
          const codes = ((e.restaurant.body && e.restaurant.body.diagnostics) || []).map(d => d.code);
          const first = codes.find(c => SETTINGS_CODES.includes(c));
          this.settingsMessage = { severity: "error",
            text: this.$t(first ? `components.restaurant.settingsRefused.${first}` : "components.restaurant.settingsRefused.other") };
        } else {
          console.error("Restaurant settings not saved:", status || e);
          this.settingsMessage = { severity: "error", text: this.$t("components.restaurant.answer.error") };
        }
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.restaurant {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 1100px;
}

h3 {
  margin: 0 0 8px;
  font-size: 16px;
}

h4 {
  margin: 0 0 6px;
  font-size: 14px;
}

.restaurant-day-picker,
.restaurant-service-head,
.restaurant-row,
.restaurant-table-type {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.restaurant-service-head h3 {
  margin: 0;
}

.restaurant-covers,
.restaurant-help,
.restaurant-legend,
.restaurant-empty,
.restaurant-notes,
.restaurant-reason {
  color: @mrcall_grey_text;
  font-size: 13px;
  margin: 0;
}

.restaurant-slots {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.restaurant-slot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid @mrcall_light_grey_2;
}

.restaurant-slot-time {
  font-weight: 600;
  min-width: 48px;
}

.restaurant-slot-arriving {
  min-width: 90px;
  font-size: 13px;
}

.restaurant-slot-area {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.restaurant-row {
  padding: 6px 0;
  border-bottom: 1px solid @mrcall_light_grey_2;
}

.restaurant-booking-time {
  font-weight: 600;
}

.restaurant-allergies {
  color: @mrcall_red;
}

.restaurant-form {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
  margin-bottom: 10px;

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
  }
}

.restaurant-form-wide {
  grid-column: 1 / -1;
}

.restaurant-settings {
  display: flex;
  flex-direction: column;
  gap: 10px;

  > label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    max-width: 320px;
  }
}

.restaurant-table-type label,
.restaurant-seats {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}

.restaurant-overbook {
  margin-left: 8px;
}
</style>
