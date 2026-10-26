<template>
  <Dialog
    :visible="visible"
    modal
    :header="$t('components.callInsights.deleteReport.title')"
    :style="{ width: '30rem' }"
    class="insights-ui"
    :breakpoints="{ '640px': '96vw' }"
    @update:visible="$emit('update:visible', $event)"
  >
    <form v-if="report" class="delete-form" @submit.prevent="confirm">
      <p>{{ $t("components.callInsights.deleteReport.what", { period }) }}</p>
      <label for="delete-reason" class="delete-label">{{ $t("components.callInsights.deleteReport.reason") }}</label>
      <Textarea id="delete-reason" v-model="reason" rows="3" autoResize class="delete-reason" />
      <p v-if="failed" class="delete-error" role="alert">{{ $t("components.callInsights.state.actionFailed") }}</p>
      <div class="delete-actions">
        <Button type="button" text :label="$t('components.callInsights.request.cancel')" @click="$emit('update:visible', false)" />
        <Button type="submit" severity="danger" :label="$t('components.callInsights.deleteReport.confirm')" :disabled="!reason.trim() || busy" :loading="busy" />
      </div>
    </form>
  </Dialog>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import InsightsReports from "@/utils/InsightsReports";
import { isSessionEnded } from "@/firebase/session";

/**
 * An admin's delete of one report (docs/briefs/2026-10-24-insights-reports-ux.md in StarChat, "Regeneration and
 * delete"): soft, every revision of it, with a reason the admin writes. StarChat refuses anyone else; the button is
 * shown to an admin only.
 */
export default {
  props: {
    visible: { type: Boolean, default: false },
    business: { type: Object, required: true },
    report: { type: Object, default: null },
  },
  emits: ["update:visible", "deleted"],
  data() {
    return { reason: "", busy: false, failed: false };
  },
  computed: {
    period() {
      if (!this.report) return "";
      return InsightsReports.periodLabel(this.report.periodStart, this.report.periodEnd,
        this.business.timeZone || InsightsReports.FALLBACK_ZONE, this.$i18n.locale);
    },
  },
  watch: {
    visible(open) {
      if (open) { this.reason = ""; this.failed = false; }
    },
  },
  methods: {
    confirm() {
      if (!this.reason.trim() || this.busy) return;
      this.busy = true;
      this.failed = false;
      CallInsights.deleteReport(this.$store.state.user, {
        businessId: this.business.businessId,
        periodStart: this.report.periodStart,
        periodEnd: this.report.periodEnd,
        requestId: this.report.requestId || undefined,
        reason: this.reason.trim(),
      })
        .then(() => {
          this.$emit("deleted", this.report);
          this.$emit("update:visible", false);
        })
        .catch((error) => {
          if (isSessionEnded(error)) return;
          this.failed = true;
        })
        .finally(() => { this.busy = false; });
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.delete-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 14px;

  p {
    margin: 0;
  }
}

.delete-label {
  font-weight: 600;
}

.delete-reason {
  width: 100%;
}

.delete-error {
  color: @mrcall_status_danger;
}

.delete-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
