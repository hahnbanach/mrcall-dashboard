<template>
  <div class="main-page-content-section analytics-page">
    <Analytics/>
  </div>
  <footer id="pre-footer">
    <PreFooterRequireAssistance/>
  </footer>
</template>

<script>
import Analytics from "@/components/Analytics";
import PreFooterRequireAssistance from "@/components/PreFooterRequireAssistance";
import {computed} from "vue";
import {useStore} from "vuex";

export default {
  components: {Analytics, PreFooterRequireAssistance},
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
  created() {
  },
  mounted() {
    const self = this;
    if (self.user && self.user.email) {
      this.$gtag.event("analytics", {
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

// The section is a flex item with auto margins, which sizes it to its widest content: on a phone
// the analytics (a 640px heatmap, wide tables) made the whole page 960px wide and cut every section
// on the right. Held to the screen's width, each wide block scrolls inside its own container.
.analytics-page {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}

#pre-footer {
  margin-top: auto;
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}
</style>
