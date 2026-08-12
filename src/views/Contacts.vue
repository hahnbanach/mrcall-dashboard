<template>
  <div class="main-page-content-section">
    <Contacts/>
  </div>
  <footer id="pre-footer">
    <PreFooterRequireAssistance/>
  </footer>
</template>

<script>
import Contacts from "@/components/Contacts";
import PreFooterRequireAssistance from "@/components/PreFooterRequireAssistance";

export default {
  components: {Contacts, PreFooterRequireAssistance},
  setup() {
  },
  data() {
    return {
    }
  },
  mounted() {
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
