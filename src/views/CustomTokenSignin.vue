<template>
  <div class="main-page-content-section">
    <p class="title">{{ $t('views.customtokensignin.title') }}</p>
    <br>
  </div>
</template>

<script>
import router from "@/router";
import {useStore} from "vuex";
import {useI18n} from "vue-i18n";
import Tr from "@/i18n/translation"

export default {
  data: () => {
    const store = useStore()
    const { t } = useI18n()

    return {
      store,
      router
    }
  },
  methods: {
    async handleToken() {
      console.debug("Custom Signin token: ", this.$route.query.customtoken);
      console.debug("Custom parameters: ", this.$route.query);

      try {
        await this.store.dispatch('signinCustomToken', {
          token: this.$route.query.customtoken
        })

        //set the reduced navigation bar
        this.store.commit('setWebviewMode', true);
        if(this.$route.query.caller)
          this.store.commit('setOsFromWebview', this.$route.query.caller);
        if(this.$route.query.language) {
          const selectedLocale = this.$route.query.language
          if(selectedLocale.startsWith('it')) {
            await Tr.switchLanguage('it-IT')
          } else {
            await Tr.switchLanguage('en-US')
          }
        }
        if(this.$route.query.redirect) {
          const redirectJsonString = decodeURIComponent(this.$route.query.redirect)
          const redirectJson = JSON.parse(redirectJsonString)
          console.debug("Custom redirect parameters: ", redirectJson);
          this.router.replace({path: redirectJson.path, query: redirectJson.query})
        } else {
          this.router.replace('/businesses')
        }
      } catch (err) {
        this.error = err.message
        this.router.replace('/login')
      }
    },
  },
  mounted() {
    window.scrollTo(0, 0);
    this.handleToken();
  },
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';

</style>