<template>
  <div class="main-page-content-section content">
    <SubmitOutboundCall></SubmitOutboundCall>
  </div>
  <footer id="pre-footer">
    <PreFooterRequireAssistance/>
  </footer>
</template>

<script>
import SubmitOutboundCall from "@/components/SubmitOutboundCall";
import PreFooterRequireAssistance from "@/components/PreFooterRequireAssistance";
import {useI18n} from "vue-i18n";
import {useRouter} from "vue-router";
import {useStore} from "vuex";

export default {
  components: {SubmitOutboundCall, PreFooterRequireAssistance},
  setup() {
    const { t } = useI18n()
    const router = useRouter()
    const store = useStore()

    return {
      t,
      store,
      router,
    }
  },
  data() {
    return {
    }
  },
  created() {
  },
  mounted() {
    window.scrollTo(0, 0);
  },
  methods: {}
}
</script>

<style lang="less" scoped>
#pre-footer {
  margin-top: auto;
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.content {
  width: 100%;
  max-width: 800px;
  margin: auto;

  @media screen and (max-width: 640px) {
    margin: 2em auto auto auto;
    padding: 1em 0 1em 0 !important;
  }
}
</style>