<template>
  <TemplateEditor :templateName="$route.params.name" />
</template>

<script>
import TemplateEditor from '@/components/admin/templates/TemplateEditor.vue'

export default {
  components: { TemplateEditor }
}
</script>
