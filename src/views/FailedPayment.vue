<template>
  <div class="min-h-full flex flex-column justify-content-between">
    <div class="payment-content-section main-page-content-section flex-shrink-0 text-center">
      <p class="title md:text-4xl text-3xl mb-3">{{ $t('views.failedpayment.failedPayment') }}</p>

      <Button @click="router.push('/businesses')" 
        class="px-6 py-3 md:w-auto w-full"
        icon="pi pi-fw pi-box" :label="$t('views.failedpayment.gotoAssistant')" />
    </div>
    <footer id="footer">
      <PreFooterRequireAssistance/>
    </footer>
  </div>
</template>

<script>
import router from "@/router";
import PreFooterRequireAssistance from "@/components/PreFooterRequireAssistance";
import {useStore} from "vuex";
import {computed} from "vue";
import {onAuthStateChanged} from "firebase/auth";
import {auth} from "@/firebase/config";

export default {
  components: {PreFooterRequireAssistance},
  data: () => {
    const store = useStore()

    const pageTexts = {
      it: {
        failedPayment: "La registrazione del metodo di pagamento non è andata a buon fine, se hai bisogno di supporto contatta l'assistenza",
        gotoAssistant: "Ritorna alla pagina degli assistenti",
      }
    }

    return {
      store,
      user: computed(() => store.state.user),
      router,
      name: "Failed payment page",
      pageTexts
    }
  },
  mounted() {
    window.scrollTo(0, 0);
    const businessId = this.$route.query.id;
    let isWebView = false ;
    if(this.$route.query.webview) {
      isWebView = JSON.parse(this.$route.query.webview) ;
    }
    let sessionReference = "anonymous" ;
    if(this.$route.query.session_reference) {
      sessionReference = this.$route.query.session_reference ;
    }
    this.store.commit('setWebviewMode', isWebView);
    if(! this.store.state.user) {
      onAuthStateChanged(auth, (user) => {
        if (user && user.emailVerified && !user.isAnonymous) {
          console.debug("UserStateChanged:", user)
          this.$gtag.event("payment_failed", {
            'business_id': businessId,
            'user_email': user.email,
            'session_reference': sessionReference
          });
        }
      })
    } else {
      this.$gtag.event("payment_failed", {
        'business_id': businessId,
        'user_email': this.store.state.user.email
      });
    }
  },
}
</script>

<style lang="less" scoped>
@import '../assets/style/default';

#footer {
  margin-top: auto;
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}
</style>
