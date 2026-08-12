<template>
  <div class="main-page-content-section">
    <BusinessPhoneNumberVerification/>
  </div>
</template>

<script>
import BusinessPhoneNumberVerification from "@/components/BusinessPhoneNumberVerification";

export default {
  components: {BusinessPhoneNumberVerification},
  setup() {
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
  methods: {
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';

</style>