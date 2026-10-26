<template>
  <div class="paged-table">
    <InsightsState
      :status="state.status"
      :empty="state.status === 'ok' && state.items.length === 0"
      :empty-text="emptyText"
      :keep-content="state.status === 'loading' && state.items.length > 0"
      @retry="state.retry()"
    >
      <!-- On a phone the header row is hidden and every row is a card: the order is chosen here instead. -->
      <div v-if="sortable.length" class="paged-table-mobile-sort">
        <label :for="sortId">{{ $t("components.callInsights.pager.sortBy") }}</label>
        <select :id="sortId" :value="state.sort" @change="state.setSort($event.target.value)">
          <option v-for="column in sortable" :key="column.sortKey" :value="column.sortKey">{{ column.label }}</option>
        </select>
        <Button
          type="button" size="small" outlined
          :icon="state.direction === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'"
          :label="$t(state.direction === 'asc' ? 'components.callInsights.pager.ascending' : 'components.callInsights.pager.descending')"
          @click="state.setSort(state.sort)"
        />
      </div>
      <div class="paged-table-scroll">
        <table class="paged-table-table">
          <caption class="visually-hidden">{{ caption }}</caption>
          <thead>
            <tr>
              <th
                v-for="column in columns"
                :key="column.key"
                scope="col"
                :class="column.class"
                :aria-sort="ariaSort(column)"
              >
                <button
                  v-if="column.sortKey"
                  type="button"
                  class="paged-table-sort"
                  @click="state.setSort(column.sortKey)"
                >
                  <span>{{ column.label }}</span>
                  <i :class="sortIcon(column)" aria-hidden="true"></i>
                </button>
                <span v-else>{{ column.label }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in state.items" :key="rowKey(row)">
              <tr :class="rowClass ? rowClass(row) : null">
                <td v-for="column in columns" :key="column.key" :data-label="column.label" :class="column.class">
                  <div class="paged-table-cell"><slot :name="'cell-' + column.key" :row="row">{{ row[column.key] }}</slot></div>
                </td>
              </tr>
              <slot name="after-row" :row="row" :colspan="columns.length" />
            </template>
          </tbody>
        </table>
      </div>
      <nav v-if="state.total > 0" class="paged-table-pager" :aria-label="pagerLabel">
        <span class="paged-table-range">{{ $t("components.callInsights.pager.range", { from: firstShown, to: lastShown, total: state.total }) }}</span>
        <span v-if="pageCount > 1" class="paged-table-pages">
          <Button
            type="button" size="small" text icon="pi pi-angle-left"
            :disabled="page === 1"
            :aria-label="$t('components.callInsights.pager.previous')"
            @click="goToPage(page - 1)"
          />
          <Button
            v-for="n in pageNumbers"
            :key="n"
            type="button" size="small"
            :text="n !== page"
            :label="String(n)"
            :aria-label="$t('components.callInsights.pager.page', { n })"
            :aria-current="n === page ? 'page' : null"
            @click="goToPage(n)"
          />
          <Button
            type="button" size="small" text icon="pi pi-angle-right"
            :disabled="page === pageCount"
            :aria-label="$t('components.callInsights.pager.next')"
            @click="goToPage(page + 1)"
          />
        </span>
      </nav>
    </InsightsState>
  </div>
</template>

<script>
import InsightsState from "@/components/analytics/InsightsState.vue";

/**
 * The one table of the server-paged lists (docs/briefs/2026-10-24-insights-reports-ux.md, "Throughout"): a real
 * table with a caption, the sortable headers as buttons whose `aria-sort` says the order in force, its page numbers and
 * "1–10 di N", and its states through `InsightsState`. Under 640 pixels each row becomes a card, every cell under its
 * column's label. `state` is a `CallInsights.serverPage`; a column with `sortKey` sorts on StarChat's key. A cell is
 * the slot `cell-<key>`; `after-row` adds a row under a row (an expansion).
 */
export default {
  components: { InsightsState },
  props: {
    state: { type: Object, required: true },
    columns: { type: Array, required: true },
    rowKey: { type: Function, required: true },
    rowClass: { type: Function, default: null },
    caption: { type: String, required: true },
    emptyText: { type: String, default: "" },
  },
  computed: {
    sortable() {
      return this.columns.filter((c) => c.sortKey);
    },
    sortId() {
      return "sort-" + this.caption.replace(/[^A-Za-z0-9]+/g, "-");
    },
    page() {
      return Math.floor(this.state.offset / this.state.size) + 1;
    },
    pageCount() {
      return Math.max(1, Math.ceil(this.state.total / this.state.size));
    },
    // At most five numbers, the current page among them.
    pageNumbers() {
      const count = this.pageCount;
      const start = Math.max(1, Math.min(this.page - 2, count - 4));
      const end = Math.min(count, start + 4);
      const numbers = [];
      for (let n = start; n <= end; n++) numbers.push(n);
      return numbers;
    },
    firstShown() {
      return this.state.items.length === 0 ? 0 : this.state.offset + 1;
    },
    lastShown() {
      return this.state.offset + this.state.items.length;
    },
    pagerLabel() {
      return this.$t("components.callInsights.pager.label", { name: this.caption });
    },
  },
  methods: {
    ariaSort(column) {
      if (!column.sortKey) return null;
      if (this.state.sort !== column.sortKey) return "none";
      return this.state.direction === "asc" ? "ascending" : "descending";
    },
    sortIcon(column) {
      if (this.state.sort !== column.sortKey) return "pi pi-sort-alt paged-table-sort-idle";
      return this.state.direction === "asc" ? "pi pi-sort-amount-up-alt" : "pi pi-sort-amount-down";
    },
    goToPage(n) {
      if (n < 1 || n > this.pageCount || n === this.page) return;
      this.state.goTo((n - 1) * this.state.size);
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.paged-table-scroll {
  overflow-x: auto;
  background: @mrcall_white;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
}

.paged-table-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  color: @mrcall_dark_grey_text;

  th, td {
    text-align: left;
    padding: 10px 8px;
    border-bottom: 1px solid @mrcall_borders;
    vertical-align: top;
  }

  th {
    font-size: 12px;
    font-weight: 700;
    color: @mrcall_grey_text2;
    white-space: nowrap;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
}

.paged-table-sort {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid @mrcall_blue;
    outline-offset: 2px;
  }
}

.paged-table-sort-idle {
  opacity: 0.4;
}

.paged-table-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  font-size: 13px;
  color: @mrcall_grey_text;
}

.paged-table-pages {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.paged-table-mobile-sort {
  display: none;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 14px;

  select {
    padding: 6px 8px;
    border: 1px solid @mrcall_light_grey_1;
    border-radius: 6px;
    background: @mrcall_white;
    font: inherit;
  }
}

// Narrow screens: each row a card, each cell under its column's label.
@media screen and (max-width: 640px) {
  .paged-table-mobile-sort {
    display: flex;
  }

  .paged-table-scroll {
    border: none;
    background: transparent;
  }

  .paged-table-table {
    thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }

    // A card holds its values two by two, each under its column's name; the first (what the row is) and the last
    // (its actions) take the card's width. One value per line made a report's card eight lines tall (U19 m19).
    tbody tr {
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: @mrcall_white;
      border: 1px solid @mrcall_borders;
      border-radius: 12px;
      margin-bottom: 10px;
      padding: 6px 0;
    }

    td {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      border-bottom: none;
      padding: 6px 12px;

      &:first-child,
      &:last-child {
        grid-column: 1 / -1;
      }

      &::before {
        content: attr(data-label);
        font-size: 12px;
        font-weight: 700;
        color: @mrcall_grey_text2;
      }
    }
  }
}
</style>
