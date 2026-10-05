<template>
  <div class="retention">
    <p class="retention-intro">{{ $t("components.retention.intro") }}</p>

    <Message v-if="loadError" severity="error" :closable="false">{{ $t("components.retention.loadError") }}</Message>

    <template v-if="info">
      <div class="retention-class">
        <div>
          <span class="retention-class-label">{{ $t("components.retention.class") }}</span>
          <strong>{{ info.retentionClass.name }}</strong>
        </div>
        <div class="retention-class-source">{{ $t("components.retention.source") }}: {{ info.retentionClass.source }}</div>
      </div>

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
            :min="minimum(term)"
            :useGrouping="false"
            showButtons
          />
          <span>{{ $t("components.retention.days") }}</span>
        </div>
        <small v-if="minimum(term) > 0" class="retention-minimum">
          {{ $t("components.retention.minimum", { days: minimum(term), class: info.retentionClass.name }) }}
        </small>
        <small class="retention-effective">{{ $t("components.retention.inForce") }}: {{ describe(info.effective[term.key]) }}</small>
      </div>

      <Message v-if="message" :severity="message.severity" :closable="false">{{ message.text }}</Message>
      <Button :label="$t('components.retention.save')" icon="pi pi-check" :loading="saving" @click="save" />
    </template>
  </div>
</template>

<script>
import RetentionApi from "@/utils/Retention";

/**
 * The owner's page for how long a business keeps its calls. Three terms, each the class's default,
 * never, or a number of days: archive (the call leaves the inbox), delete (the call and its
 * recording go) and trash (a trashed call goes, counted from when it was trashed). The class, its
 * legal minimums and their source come from StarChat, which also refuses a term below a minimum;
 * this page shows the minimum and keeps the field above it, and decides nothing.
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
      terms: [
        { key: "archiveAfterDays", minimumKey: null },
        { key: "deleteAfterDays", minimumKey: "minDeleteAfterDays" },
        { key: "trashDeleteAfterDays", minimumKey: "minTrashDeleteAfterDays" },
      ],
    };
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
        this.modes[term.key] = set === null || set === undefined ? "class" : set === -1 ? "never" : "days";
        this.days[term.key] = set !== null && set !== undefined && set >= 0
          ? set : Math.max(info.effective[term.key], this.minimum(term), 1);
      }
    },
    minimum(term) {
      return term.minimumKey && this.info ? this.info.retentionClass[term.minimumKey] || 0 : 0;
    },
    classDefault(term) {
      const name = "default" + term.key.charAt(0).toUpperCase() + term.key.slice(1);
      return this.info.retentionClass[name];
    },
    describe(value) {
      return value === -1 ? this.$t("components.retention.never") : this.$t("components.retention.afterDays", { days: value });
    },
    modeOptions(term) {
      return [
        { value: "class", label: this.$t("components.retention.classDefault", { value: this.describe(this.classDefault(term)) }) },
        { value: "never", label: this.$t("components.retention.never") },
        { value: "days", label: this.$t("components.retention.custom") },
      ];
    },
    termValue(term) {
      const mode = this.modes[term.key];
      return mode === "class" ? null : mode === "never" ? -1 : this.days[term.key];
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
        if (body.code === "retention.term_below_minimum") {
          this.message = { severity: "error", text: this.$t("components.retention.belowMinimum", {
            term: this.$t(`components.retention.${body.constraint.field}.title`), days: body.constraint.minimum }) };
        } else if (body.code === "retention.revision_mismatch") {
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

.retention-class {
  border: 1px solid @mrcall_borders;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.retention-class-label {
  color: @mrcall_grey_text2;
  margin-right: 8px;
}

.retention-class-source {
  font-size: 13px;
  color: @mrcall_grey_text2;
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

.retention-minimum {
  color: @mrcall_dark_grey_text;
  font-weight: 600;
}

.retention-effective {
  color: @mrcall_grey_text2;
}
</style>
