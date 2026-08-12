<template>
  <div class="main-page-content-section">
    <p class="title">{{ $t('views.privacypolicy.privacyOfTheService') }}</p>
    <br>
  </div>
</template>

<script>
import router from "@/router";

export default {
  data: () => {
    const pageTexts = {
      it: {
        title: "Privacy Policy del servizio MrCall"
      }
    }

    return {
      router,
      pageTexts
    }
  },
  mounted() {
    window.scrollTo(0, 0);
  },
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';

</style>