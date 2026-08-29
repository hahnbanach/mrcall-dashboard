<template>
  <div class="main-page-content-section">
    <p class="title">{{ $t('views.payment.redirectToPaymentMethod') }}</p>
    <br>
  </div>
</template>

<script>
import {computed} from 'vue'
import {useStore} from 'vuex'
import {useConfirm} from "primevue/useconfirm"
import {useToast} from "primevue/usetoast"
import axios from "axios"
import stripeUtils from "@/utils/Stripe"
import { writeUtmParamsToBusiness } from "@/utils/UtmTracking"

export default {
  setup: function () {
    const toast = useToast()
    const confirm = useConfirm()

    return {
      toast,
      confirm
    }
  },
  data: function () {
    const store = useStore()
    const business = computed(() => store.state.selectedBusiness)

    return {
      store,
      business,
      showProgressBar: false,
      user: computed(() => store.state.user),
      templates: []
    }
  },
  methods: {
    async getBusinessSubscriptionInfo(businessId) { //TODO: use this function to retrieve subscription info from stripe
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      }
      const url = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/business/subscription?id=" + businessId
      axios.get(url,
          {
            headers: headers
          }
      ).then((response) => {
        console.log("RES:", response.data)
        if(response.data) {
          this.subscriptionInfo[businessId] = response.data
        } else {
          this.subscriptionInfo[businessId] = undefined
        }
      }).catch((error) => {
        console.error(error)
      })
    },
    async selectPlan(businessId, template) {
      console.debug("Template:", template, businessId)
      const isWebview = this.store.state.isWebview ;
      const now = Date.now() ;
      const sessionReference = `${businessId}:${now}` ;
      const successUrl = process.env.VUE_APP_SERVICE_BASE_URL + process.env.VUE_APP_PUBLIC_PATH +
      `/success_payment?id=${businessId}&template=${template}&webview=${isWebview}&session_reference=${sessionReference}` ;
      const cancelUrl = process.env.VUE_APP_SERVICE_BASE_URL + process.env.VUE_APP_PUBLIC_PATH +
      `/failed_payment?id=${businessId}&template=${template}&webview=${isWebview}&session_reference=${sessionReference}` ;

      await writeUtmParamsToBusiness(this.store, this.user, this.business)

      this.showProgressBar = true;
      const session = await stripeUtils.createSession(this.user, template, businessId, successUrl, cancelUrl) ;
      this.showProgressBar = false;
      console.debug("Session:", session);

      this.$gtag.event("begin_checkout", {
        'user_email': this.user.email,
        'business_id': this.business.businessId,
        'session_id': session.id,
        'session_reference': sessionReference,
        'expires_at': session.expires_at,
        'currency': session.currency,
        'amount_total': session.amount_total,
        'amount_subtotal': session.amount_subtotal
      });
      window.location.href = session.url // redirect to payment
    }
  },
  async mounted () {
    const businessId = this.business.businessId
    const template = this.business.template
    await this.selectPlan(businessId, template)
  }
}
</script>

<style lang="less" scoped>
.p-button {
  margin-right: .5rem;
}

::v-global(.subscription-modal-dialog .visibility-reject-button-off) {
  display: none;
}
::v-global(.subscription-modal-dialog div.p-dialog-header-icons) {
  display: none;
}

.card-not-selected {
  margin-left: 1em ;
  margin-right: 1em ;
}
</style>
