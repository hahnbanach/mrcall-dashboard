<template>
  <Toast></Toast>
  <div v-for="template in templates.filter(v => (v.visible && v.name === business.template) || v.name === business.template)" :key="template.name">
    <Card :class="business.template !== template.name && 'card-not-selected'">
      <template #title>
        <div class="card-title-row">
          <span>{{template.humanName}}</span>
          <Tag v-if="business.subscriptionStatus"
               :value="$t(`components.businesses.form.subscriptionStatusLabels.${business.subscriptionStatus}`)"
               :severity="getStatusSeverity(business.subscriptionStatus)" />
        </div>
      </template>
      <!-- hiding the plan name
      <template #subtitle>
        {{template.name}}
      </template>
      -->
      <template #content>
        {{template.description}}
      </template>
      <template #footer>
        <div v-if="business.template !== 'TEST' && business.appleOriginalTransactionId">
          <div v-if="(isWebView && osName !== 'ios') || ! isWebView">
            {{$t('components.subscription.managedThroughAppleInApp')}}
          </div>
        </div>
        <div v-else>
          <Button v-if="business.template === template.name &&
          (/*! business.stripeCustomerId &&*/ ! business.stripeSubscriptionId)"
                  @click="selectPlan(business.businessId, template)" icon="pi pi-check"
                  :label="$t('components.subscription.buyButtonLabel')" />
          <div v-else-if="business.stripeCustomerId &&
              business.template === template.name &&
              business.stripeSubscriptionId"
               class="button-group">
            <template v-if="(isWebView && osName !== 'ios') || ! isWebView">
              <Button v-if="business.subscriptionStatus === 'TRIALING' ||
                            business.subscriptionStatus === 'ACTIVE'"
                      @click="cancelSubscriptionDialog(business.stripeSubscriptionId)"
                      icon="pi pi-trash"
                      :label="$t('components.subscription.cancelButtonLabel')" severity="warn" />
              <Button v-else-if="business.subscriptionStatus === 'EXPIRING'"
                      @click="reactivateSubscriptionDialog(business.stripeSubscriptionId)"
                      icon="pi pi-undo"
                      :label="$t('components.subscription.reactivateButtonLabel')" severity="warn" />
              <Button @click="gotoStripeCustomerPortal()"
                      icon="pi pi-credit-card"
                      :label="$t('components.subscription.manageSubscriptionLabel')" severity="secondary" />
            </template>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script>
import {computed} from 'vue'
import {useStore} from 'vuex'
import {useConfirm} from "primevue/useconfirm"
import {useToast} from "primevue/usetoast"
import axios from "axios"
import router from "@/router"
import {useI18n} from "vue-i18n";
import Tr from "@/i18n/translation"
import { writeUtmParamsToBusiness } from "@/utils/UtmTracking"

export default {
  setup: () => {
    const toast = useToast()
    const confirm = useConfirm()

    return {
      toast,
      confirm
    }
  },
  data: () => {
    const store = useStore()
    const business = computed(() => store.state.selectedBusiness)
    const isWebView = computed(() => store.state.isWebview)
    const osName = computed(() => store.state.webviewOsName)
    const langCode = computed(() => Tr.getLocale()) ;
    const { t } = useI18n()
    return {
      t,
      langCode,
      store,
      isWebView,
      osName,
      business,
      showProgressBar: false,
      session: null,
      user: computed(() => store.state.user),
      templates: []
    }
  },
  methods: {
    getStatusSeverity(status) {
      const map = {
        'ACTIVE': 'success',
        'FREE': 'success',
        'TRIALING': 'info',
        'ONBOARDING': 'warn',
        'TEST': 'warn',
        'EXPIRING': 'warn',
        'CANCELED': 'danger',
        'EXPIRED': 'danger',
        'SUSPENDED': 'danger',
        'UNPAID': 'danger',
        'EXTERNAL': 'secondary',
        'UNKNOWN': 'secondary'
      }
      return map[status] || 'secondary'
    },
    gotoStripeCustomerPortal: () => {
      console.debug("Redirecting to: " + process.env.VUE_APP_STRIPE_USER_PORTAL)
      window.open(process.env.VUE_APP_STRIPE_USER_PORTAL, "_self")
    },
    async createSession(templateName, businessId) {
      this.showProgressBar = true;
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      };
      const sessionIn = {
        businessId: businessId,
        successUrl: process.env.VUE_APP_SERVICE_BASE_URL + process.env.VUE_APP_PUBLIC_PATH +
            "/success_payment?id=" + businessId + "&template=" + templateName,
        cancelUrl: process.env.VUE_APP_SERVICE_BASE_URL + process.env.VUE_APP_PUBLIC_PATH +
            "/failed_payment?id=" + businessId + "&template=" + templateName
      }
      console.log(headers, sessionIn)
      await axios.post(process.env.VUE_APP_STARCHAT_URL + "/stripe/v1/mrcall0/session/business",
          sessionIn,
          {
            headers: headers
          }
      ).then((response) => {
        console.log(response)
        if(response.data) {
          this.session = response.data
        } else {
          console.error("Session data was empty:", response)
        }
        this.showProgressBar = false
      }).catch((error) => {
        console.error(error)
        this.showProgressBar = false
        if(error.response.status === 401) {
          this.store.dispatch('logout')
          router.push('/login')
        } else {
          this.toast.add({severity:'error', summary: this.t('components.subscription.toastPaymentSubscriptionSummary'),
            detail: this.t('components.subscription.errorCreatingPaymentData'), life: 10000})
          this.setMessage("error", this.t('components.subscription.errorCreatingPaymentData'))
        }
      })
    },
    async selectPlan(businessId, template) {
      console.debug("Template:", template.name, businessId)
      await writeUtmParamsToBusiness(this.store, this.user, this.business)
      await this.createSession(template.name, businessId)
      console.debug("Session:", this.session)
      if(this.session)
        window.location.href = this.session.url // redirect to payment
    },
    reactivateSubscriptionDialog(stripeSubscriptionId) {
      console.debug("Reactivate subscription dialog:", stripeSubscriptionId)
      this.showProgressBar = true;
      this.toast.add({severity:'info', summary: this.t('components.subscription.toastReactivateSubscriptionSummary'),
        detail: this.t('components.subscription.toastNotifyFortcomingReactivateOperation'),
        life: 5000});
      this.reactivateSubscription(stripeSubscriptionId)
      this.showProgressBar = false;
    },
    reactivateSubscription(stripeSubscriptionId) {
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      }
      axios.put(process.env.VUE_APP_STARCHAT_URL +
          "/stripe/v1/mrcall0/subscription?id=" + stripeSubscriptionId,
          {},
          {
            headers: headers
          }
      ).then((response) => {
        this.showProgressBar = false;
        console.debug("Reactivate subscription response:", response)
        this.confirm.require({
          message: this.t('components.subscription.confirmCompletedReactivationSubscriptionSummary'),
          header: this.t('components.subscription.toastReactivateSubscriptionSummary'),
          icon: 'pi pi-check-circle',
          rejectClass: 'visibility-reject-button-off',
          acceptLabel: 'Ok',
          defaultFocus: 'accept',
          accept: () => {
            router.replace('/businesses')
          }
        });
      }).catch((error) => {
        this.showProgressBar = false;
        this.toast.add({severity:'error', summary: this.t('components.subscription.toastReactivateSubscriptionSummary'),
          detail: this.t('components.subscription.toastErrorSummary') + ": " + error, life: 10000})
        if(error.response.status === 401) {
          this.store.dispatch('logout')
          this.router.replace('/login')
        }
      })
    },
    setMessage(severity, content) {
      const id = Date.now()
      this.message = {
        id: id,
        severity: severity,
        content: content,
      }
    },
    cancelSubscriptionDialog(stripeSubscriptionId) {
      console.debug("Cancel subscription dialog:", stripeSubscriptionId)
      this.showProgressBar = true;
      this.confirm.require({
        message: this.t('components.subscription.confirmationCancellationRequest'),
        header: this.t('components.subscription.confirmCancellation'),
        icon: 'pi pi-exclamation-triangle',
        defaultFocus: 'reject',
        accept: () => {
          console.log("Continue with subscription cancelation")
          this.toast.add({severity:'warn', summary: this.t('components.subscription.toastCancelSubscriptionSummary'),
            detail: this.t('components.subscription.toastNotifyFortcomingCancelOperation'),
            life: 5000});
          this.cancelSubscription(stripeSubscriptionId)
        },
        reject: () => {
          console.log("Reject of subscription cancel")
          this.toast.add({severity:'info', summary: this.t('components.subscription.toastCancellingOperationSummary'),
            detail: this.t('components.subscription.toastNotifyCanceledCancelSubscriptionOperation'),
            life: 5000});
        }
      });
      this.showProgressBar = false;
    },
    cancelSubscription(stripeSubscriptionId) {
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      }
      axios.delete(process.env.VUE_APP_STARCHAT_URL +
          "/stripe/v1/mrcall0/subscription?id=" + stripeSubscriptionId,
          {
            headers: headers
          }
      ).then((response) => {
        this.showProgressBar = false;
        console.debug("Cancel subscription response:", response)
        this.confirm.require({
          message: this.t('components.subscription.confirmCompletedCancelationSubscriptionSummary'),
          header: this.t('components.subscription.toastCancelSubscriptionSummary'),
          icon: 'pi pi-check-circle',
          rejectClass: 'visibility-reject-button-off',
          acceptLabel: 'Ok',
          defaultFocus: 'accept',
          accept: () => {
            router.replace('/businesses')
          }
        });
      }).catch((error) => {
        this.showProgressBar = false;
        this.toast.add({severity:'error', summary: this.t('components.subscription.toastCancelSubscriptionSummary'),
          detail: this.t('components.subscription.toastErrorSummary') + ": " + error, life: 10000})
        if(error.response.status === 401) {
          this.store.dispatch('logout')
          this.router.replace('/login')
        }
      })
    },
    templateList() {
      this.showProgressBar = true;
      let headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      };
      axios.get(process.env.VUE_APP_STARCHAT_URL +
          `/mrcall/v1/mrcall0/crm/template?language=${this.langCode}`,
          {
            headers: headers
          }
      ).then((response) => {
        if(response.data) {
          this.templates = response.data
        }
        this.showProgressBar = false
      }).catch((error) => {
        console.error(error)
        this.showProgressBar = false
        if(error.response.status === 401) {
          this.store.dispatch('logout')
          router.push('/login')
        }
      })
    }
  },
  mounted () {
    this.templateList()
  }
}
</script>

<style lang="less" scoped>
.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.card-not-selected {
  margin-left: 1em;
  margin-right: 1em;
}
</style>
