<template>
  <div class="main-page-content-section">
    <AnalyticsAdmin/>
  </div>
  <footer id="pre-footer">
    <PreFooterRequireAssistance/>
  </footer>
</template>

<script>
import AnalyticsAdmin from "@/components/AnalyticsAdmin";
import PreFooterRequireAssistance from "@/components/PreFooterRequireAssistance";
import {computed} from "vue";
import {useStore} from "vuex";

export default {
  components: {AnalyticsAdmin, PreFooterRequireAssistance},
  setup() {
    const store = useStore();
    return {
      store,
      user: computed(() => store.state.user)
    }
  },
  data() {
    return {
    }
  },
  mounted() {
    const self = this;
    if (self.user && self.user.email) {
      this.$gtag.event("analytics_admin", {
        'user_email': self.user.email
      })
    }
    window.scrollTo(0, 0);
  },
  methods: {
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';

#pre-footer {
  margin-top: auto;
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}
</style>
