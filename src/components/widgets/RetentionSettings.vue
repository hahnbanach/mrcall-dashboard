<template>
  <div class="retention">
    <p class="retention-intro">{{ $t("components.retention.intro") }}</p>

    <Message v-if="loadError" severity="error" :closable="false">{{ $t("components.retention.loadError") }}</Message>

    <template v-if="info">
      <div v-for="term in terms" :key="term.key" class="retention-term">
        <label class="inputboxtitle" :for="'retention-' + term.key">{{ $t(`components.retention.${term.key}.title`) }}</label>
        <p class="retention-help">{{ $t(`components.retention.${term.key}.help`) }}</p>
        <SelectButton
          v-model="modes[term.key]"
          :options="modeOptions(term)"
          optionLabel="label"
          optionValue="value"
          :allowEmpty="false"
          :aria-label="$t(`components.retention.${term.key}.title`)"
        />
        <div v-if="modes[term.key] === 'days'" class="retention-days">
          <InputNumber
            :inputId="'retention-' + term.key"
            v-model="days[term.key]"
            :min="0"
            :useGrouping="false"
            showButtons
          />
          <span>{{ $t("components.retention.days") }}</span>
        </div>
        <small class="retention-effective">{{ $t("components.retention.inForce") }}: {{ describe(info.effective[term.key]) }}</small>
      </div>

      <Message v-if="message" :severity="message.severity" :closable="false">{{ message.text }}</Message>
      <Button :label="$t('components.retention.save')" icon="pi pi-check" :loading="saving" :disabled="!complete" @click="save" />
    </template>
  </div>
</template>

<script>
import RetentionApi from "@/utils/Retention";

/**
 * The owner's page for how long a business keeps its calls. Three terms, each the default, never,
 * or a number of days: archive (the call leaves the inbox), delete (the call and its recording go)
 * and trash (a trashed call goes, counted from when it was trashed). The defaults are the same for
 * every business, never unless StarChat is configured otherwise, and come from StarChat with the
 * terms; this page shows them and decides nothing.
 */
export default {
  props: {
    businessId: { type: String, required: true },
    user: { type: Object, required: true },
  },
  data() {
    return {
      info: null,
      loadError: false,
      modes: {},
      days: {},
      saving: false,
      message: null,
      terms: [{ key: "archiveAfterDays" }, { key: "deleteAfterDays" }, { key: "trashDeleteAfterDays" }],
    };
  },
  computed: {
    /** Every custom term has its number: a custom term left empty is not saved as the default. */
    complete() {
      return this.terms.every((t) => this.modes[t.key] !== "days" || Number.isInteger(this.days[t.key]));
    },
  },
  async mounted() {
    await this.load();
  },
  methods: {
    async load() {
      try {
        this.apply(await RetentionApi.get(this.user, this.businessId));
      } catch (e) {
        console.error("Retention not loaded:", e.response ? e.response.status : e);
        this.loadError = true;
      }
    },
    apply(info) {
      this.info = info;
      for (const term of this.terms) {
        const set = info.set[term.key];
        this.modes[term.key] = set === null || set === undefined ? "default" : set === -1 ? "never" : "days";
        // a custom term starts from the one in force; with never in force it starts empty, so that
        // no number is saved that the owner did not type
        const effective = info.effective[term.key];
        this.days[term.key] = set !== null && set !== undefined && set >= 0 ? set : effective >= 0 ? effective : null;
      }
    },
    describe(value) {
      return value === -1 ? this.$t("components.retention.never") : this.$t("components.retention.afterDays", { days: value });
    },
    modeOptions(term) {
      return [
        { value: "default", label: this.$t("components.retention.default", { value: this.describe(this.info.defaults[term.key]) }) },
        { value: "never", label: this.$t("components.retention.never") },
        { value: "days", label: this.$t("components.retention.custom") },
      ];
    },
    termValue(term) {
      const mode = this.modes[term.key];
      return mode === "default" ? null : mode === "never" ? -1 : this.days[term.key];
    },
    async save() {
      this.saving = true;
      this.message = null;
      const terms = Object.fromEntries(this.terms.map((t) => [t.key, this.termValue(t)]));
      try {
        this.apply(await RetentionApi.put(this.user, this.businessId, terms, this.info.revision));
        this.message = { severity: "success", text: this.$t("components.retention.saved") };
      } catch (e) {
        const body = e.retention || {};
        if (body.code === "retention.revision_mismatch") {
          await this.load();
          this.message = { severity: "warn", text: this.$t("components.retention.changedMeanwhile") };
        } else {
          console.error("Retention not saved:", e.response ? e.response.status : e);
          this.message = { severity: "error", text: this.$t("components.retention.saveError") };
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

.retention {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 720px;
}

.retention-intro,
.retention-help {
  margin: 0;
  color: @mrcall_grey_text;
  font-size: 14px;
  line-height: 1.5;
}

.retention-term {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.retention-days {
  display: flex;
  align-items: center;
  gap: 8px;
}

.retention-effective {
  color: @mrcall_grey_text2;
}
</style>
