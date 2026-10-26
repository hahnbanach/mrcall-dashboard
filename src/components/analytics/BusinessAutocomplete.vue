<template>
  <Autocomplete
    :modelValue="selected"
    :suggestions="suggestions"
    optionLabel="name"
    :minLength="2"
    :delay="300"
    forceSelection
    :placeholder="$t('components.callInsights.filters.business')"
    :aria-label="$t('components.callInsights.filters.business')"
    :emptySearchMessage="$t('components.callInsights.filters.noBusinessFound')"
    class="business-autocomplete"
    @complete="search"
    @update:modelValue="onChange"
  />
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import { isSessionEnded } from "@/firebase/session";

/**
 * The admin's business filter, by company name (docs/briefs/2026-10-24-insights-reports-ux.md in StarChat, "Admin"):
 * typing two letters lists the businesses whose name contains them (`crm/business/search`), and choosing one sets the
 * filter to its id; the id is never typed nor shown. `modelValue` is the business id, `name` what to show for it.
 */
export default {
  props: {
    modelValue: { type: String, default: "" },
    name: { type: String, default: null },
  },
  emits: ["update:modelValue", "names"],
  data() {
    return { suggestions: [] };
  },
  computed: {
    selected() {
      if (!this.modelValue) return null;
      return { businessId: this.modelValue, name: CallInsights.businessLabel(this.name, this.modelValue) };
    },
  },
  methods: {
    search(event) {
      const term = (event.query || "").trim();
      if (term.length < 2) { this.suggestions = []; return; }
      CallInsights.searchBusinesses(this.$store.state.user, term)
        .then((list) => {
          this.suggestions = list;
          const names = {};
          list.forEach((b) => { names[b.businessId] = b.name; });
          this.$emit("names", names);
        })
        .catch((error) => { if (!isSessionEnded(error)) this.suggestions = []; });
    },
    onChange(value) {
      if (value && typeof value === "object") this.$emit("update:modelValue", value.businessId);
      else if (!value) this.$emit("update:modelValue", "");
    },
  },
};
</script>

<style lang="less" scoped>
.business-autocomplete {
  min-width: 240px;
}
</style>
