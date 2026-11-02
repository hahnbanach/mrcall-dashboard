<template>
  <div class="json-editor-load-error" role="alert">
    {{ $t('components.widgets.jsonEditor.loadFailed') }}
  </div>
</template>

<script>
/**
 * What a JSON field shows when the editor's chunk could not be fetched (main.js, the async `JsonEditorVue`). The
 * value is untouched: nothing was edited, and reloading the page fetches the editor again.
 */
export default {}
</script>

<style scoped lang="less">
@import "../../assets/style/colors";

.json-editor-load-error {
  padding: 12px;
  border: 1px solid @mrcall_borders;
  border-radius: 6px;
  color: @mrcall_grey_text;
  font-size: 14px;
}
</style>
