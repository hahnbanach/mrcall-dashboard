<template>
  <div class="bulk-bar insights-ui" :class="{ 'bulk-bar-bottom': narrow }" role="toolbar" :aria-label="label">
    <span class="bulk-count">{{ $t("components.callInsights.feedback.bulk.count", { n: count }, count) }}</span>
    <slot />
  </div>
  <!-- room under the list's last row for the bar fixed at the bottom -->
  <div class="bulk-bar-room" aria-hidden="true"></div>
</template>

<script>
/**
 * The bar of a list's selected rows (brief docs/briefs/2026-10-27-classification-feedback.md, scope 4 and 5; StarChat's
 * brief, decision 9: "bulk actions sit in a bottom bar" under 600 px): fixed at the bottom of the screen on every width,
 * so it is on screen wherever the person selected, across the whole width on a narrow one. A toolbar named `label`,
 * with the count of the selection and the list's actions as its slot. The undo bar rises above it (`UndoBar.raised`).
 */
export default {
  props: {
    label: { type: String, required: true },
    count: { type: Number, required: true },
    narrow: { type: Boolean, default: false },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.bulk-bar {
  position: fixed;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  width: calc(100% - 32px);
  max-width: 700px;
  z-index: 900;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid @mrcall_borders;
  border-radius: 10px;
  background: @mrcall_white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);

  &.bulk-bar-bottom {
    left: 0;
    bottom: 0;
    transform: none;
    width: 100%;
    max-width: none;
    border-radius: 12px 12px 0 0;
  }
}

.bulk-bar-room {
  height: 96px;
}

.bulk-count {
  font-weight: 700;
  font-size: 14px;
}
</style>
