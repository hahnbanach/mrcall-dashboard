<template>
  <div class="insights-state" :aria-busy="status === 'loading' ? 'true' : 'false'">
    <template v-if="status === 'ok' && !empty">
      <slot />
    </template>
    <template v-else-if="status === 'loading' && keepContent">
      <div class="insights-state-updating" role="status">
        <ProgressBar mode="indeterminate" class="insights-state-bar" />
        <span>{{ $t("components.callInsights.state.updating") }}</span>
      </div>
      <div class="insights-state-dimmed"><slot /></div>
    </template>
    <div v-else-if="status === 'loading'" class="insights-state-note" role="status">
      <ProgressBar mode="indeterminate" class="insights-state-bar" />
      <span>{{ loadingText || $t("components.callInsights.state.loading") }}</span>
    </div>
    <div v-else-if="status === 'unavailable'" class="insights-state-note">
      {{ $t("components.callInsights.notAvailableYet") }}
    </div>
    <div v-else-if="status === 'error'" class="insights-state-note insights-state-error" role="alert">
      <span>{{ errorText || $t("components.callInsights.state.error") }}</span>
      <Button type="button" size="small" outlined icon="pi pi-refresh" :label="$t('components.callInsights.state.retry')" @click="$emit('retry')" />
    </div>
    <div v-else-if="status === 'ok' && empty" class="insights-state-note insights-state-empty">
      {{ emptyText }}
    </div>
  </div>
</template>

<script>
/**
 * THE ONE MECHANISM for loading, empty and error states (docs/briefs/2026-10-24-insights-reports-ux.md, "Throughout";
 * the handbook's UX-02): every section and list of the reports, jobs, assistants and requests draws its state here,
 * from the `status` `CallInsights.serverPage` (or a section's own request) keeps.
 * - `loading`: a progress bar and "Caricamento…", announced (`role="status"`); with `keepContent` the content already
 *   shown stays, dimmed, under "Aggiornamento…", so a page does not shrink under the row just clicked.
 * - `ok`: the content, or `emptyText` when `empty`.
 * - `unavailable` (503): the server is not ready yet, said as such, not as a failure.
 * - `error`: said, announced (`role="alert"`), with a retry (`retry`).
 * - `absent` (404): nothing; the parent hides its section.
 */
export default {
  props: {
    status: { type: String, required: true },
    empty: { type: Boolean, default: false },
    emptyText: { type: String, default: "" },
    loadingText: { type: String, default: "" },
    errorText: { type: String, default: "" },
    keepContent: { type: Boolean, default: false },
  },
  emits: ["retry"],
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.insights-state-note {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  color: @mrcall_grey_text;
  font-size: 14px;
  padding: 8px 0;
}

.insights-state-error {
  color: @mrcall_dark_grey_text;
}

.insights-state-updating {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 13px;
  color: @mrcall_grey_text;
}

.insights-state-bar {
  width: 120px;
  height: 0.3em;
}

.insights-state-dimmed {
  opacity: 0.5;
  transition: opacity 0.2s;
}
</style>
