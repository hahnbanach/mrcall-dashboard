<template>
  <details v-if="items.length > 0" class="column-help-list">
    <summary>{{ $t("components.callInsights.help.title") }}</summary>
    <dl>
      <template v-for="item in items" :key="item.label">
        <dt>{{ item.label }}</dt>
        <dd>{{ item.help }}</dd>
      </template>
    </dl>
  </details>
</template>

<script>
/**
 * How each column is counted, on a phone (brief docs/briefs/2026-10-31-analytics-ux.md, O4): there the rows are
 * cards and the header row with its `ColumnHelp` buttons is not shown, so the same texts are listed above the cards,
 * folded. `items`: `{label, help}` of the columns that have a help text. Drawn only under 641 px.
 */
export default {
  props: {
    items: { type: Array, default: () => [] },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.column-help-list {
  display: none;
  margin: 0 0 10px 0;
  font-size: 13px;
  color: @mrcall_grey_text;

  summary {
    cursor: pointer;
    font-weight: 600;
    min-height: 32px;
    display: flex;
    align-items: center;
  }

  dl {
    margin: 6px 0 0 0;
  }

  dt {
    font-weight: 700;
    color: @mrcall_dark_grey_text;
    margin-top: 6px;
  }

  dd {
    margin: 2px 0 0 0;
  }
}

@media screen and (max-width: 640px) {
  .column-help-list {
    display: block;
  }
}
</style>
