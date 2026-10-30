<template>
  <section class="analytics-filter-bar" :class="{ 'analytics-filter-bar-noted': !!scopeNote }" :aria-label="$t('components.callInsights.filterBar.title')">
    <span class="filter-bar-title">{{ $t("components.callInsights.filterBar.title") }}</span>
    <span v-if="scopeNote" class="filter-bar-note" role="status">{{ scopeNote }}</span>
    <ul
      class="filter-bar-list"
      :class="{ 'filter-bar-list-idle': !!scopeNote }"
      :aria-label="scopeNote ? $t('components.callInsights.filterBar.notApplied') : null"
    >
      <li v-for="chip in chips" :key="chip.key" class="filter-chip" :class="{ 'filter-chip-clearable': !!chip.clearLabel }">
        <span class="filter-chip-name">{{ chip.name }}</span>
        <span class="filter-chip-value" :title="chip.title || chip.value">{{ chip.value }}</span>
        <button
          v-if="chip.clearLabel"
          type="button"
          class="filter-chip-clear"
          :aria-label="chip.clearLabel"
          :title="chip.clearLabel"
          @click="$emit('clear', chip.key)"
        >
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </li>
    </ul>
  </section>
</template>

<script>
/**
 * The filters the analytics page is showing, in a bar that stays at the top while the page scrolls
 * (brief outcome 10): each with its own clear control, so a filter set from a table far down the page
 * is undone where the user is, not by scrolling back to the inputs that set it. Presentational: the
 * page says which chips there are (`{ key, name, value, title?, clearLabel? }`, no `clearLabel` for a
 * filter that cannot be undone, such as an owner's own business) and what clearing one means.
 */
export default {
  props: {
    chips: { type: Array, required: true },
    // Set while a section that follows none of these filters is on screen (the scope-wide lists):
    // what that section covers, said in the bar, and the chips shown as not applying to it.
    scopeNote: { type: String, default: null },
  },
  emits: ["clear"],
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.analytics-filter-bar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: @mrcall_white;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(15, 17, 12, 0.06);
}

.filter-bar-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  // @mrcall_grey_text2 is 4.2:1 on the bar (U19c m2)
  color: @mrcall_grey_text;
}

.filter-bar-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.filter-bar-note {
  font-size: 13px;
  font-weight: 600;
  color: @mrcall_dark_grey_text;
}

.filter-bar-list-idle {
  opacity: 0.55;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 4px 10px;
  font-size: 13px;
  background: @mrcall_light_grey_2;
  border-radius: 999px;
}

.filter-chip-clearable {
  padding-right: 4px;
  background: @mrcall_bluette;
}

.filter-chip-name {
  color: @mrcall_grey_text;
}

.filter-chip-value {
  overflow: hidden;
  max-width: 220px;
  font-weight: 600;
  color: @mrcall_dark_grey_text;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-chip-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: @mrcall_dark_grey_text;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 50%;

  &:hover,
  &:focus-visible {
    background: @mrcall_white;
  }

  i {
    font-size: 11px;
  }
}

// On a phone the title is left to the region's accessible name, and the chips wrap: in one line
// scrolling sideways, a chip past the edge was cut and its clear control out of reach (U19 m19).
// Wrapped, the bar can take two or three lines, so on a phone it stays at the top of the page
// instead of sticking over it, where it would hide the heading a link scrolled to (the UX review
// of outcome 10, second pass).
@media screen and (max-width: 640px) {
  .analytics-filter-bar {
    position: static;
    padding: 6px 8px;
  }

  .filter-bar-title {
    display: none;
  }

  .filter-chip {
    flex: 0 1 auto;
    min-width: 0;
  }

  .filter-chip-value {
    max-width: 160px;
  }

  // With the note the bar reflows instead: the note reads whole on its own line and the dimmed chips
  // wrap under it, all on screen (the D12 re-review: "last 30 day…" cut at the edge, chips off screen).
  .analytics-filter-bar-noted {
    flex-wrap: wrap;
    overflow-x: visible;

    .filter-bar-list {
      flex-wrap: wrap;
    }
  }

  .filter-bar-note {
    flex: 1 1 100%;
  }
}
</style>
