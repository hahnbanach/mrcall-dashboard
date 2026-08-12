<template>
  <div class="main-page-content-section">
    <Conversations/>
  </div>
  <footer id="pre-footer">
    <PreFooterRequireAssistance/>
  </footer>
</template>

<script>
import Conversations from "@/components/Conversations";
import PreFooterRequireAssistance from "@/components/PreFooterRequireAssistance";
import {computed} from "vue";
import {useStore} from "vuex";

export default {
  components: {Conversations, PreFooterRequireAssistance},
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
      this.$gtag.event("conversations", {
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