<template>
  <Toast></Toast>
  <div v-for="product in products.filter(v => (v.visible && (v.template === business.template || v.template === '__BASE__')) || (v.template === business.template || v.template === '__BASE__'))" :key="product.name">
    <Card>
      <template #title>
        <div class="card-title-row">
          <span>{{product.humanName}}</span>
          <Tag v-if="productSubscriptionStatus[product.name]?.status"
               :value="$t(`components.businesses.form.subscriptionStatusLabels.${productSubscriptionStatus[product.name].status}`)"
               :severity="getStatusSeverity(productSubscriptionStatus[product.name].status)" />
        </div>
      </template>
      <!-- hiding the product name
      <template #subtitle>
        {{product.name}}
      </template>
      -->
      <template #content>
        {{product.description}}
      </template>
      <template #footer>
        <div v-if="product.productType === 'onetime' && product.topup" class="button-group">
          <Button @click="selectProduct(product, business.businessId)" icon="pi pi-check"
                  :label="$t('components.products.buyButtonLabel')" />
          <Button v-if="productSubscriptionStatus[product.name]?.paymentSystem === 'UNREGISTERED' &&
                        productSubscriptionStatus[product.name]?.status !== 'ACTIVE'"
                  @click="setTopup(product, business.businessId, 'enable')"
                  icon="pi pi-cart-plus"
                  severity="warn"
                  :label="$t('components.products.enableTopupButtonLabel')" />
          <Button v-else-if="productSubscriptionStatus[product.name]?.status === 'ACTIVE'"
                  @click="setTopup(product, business.businessId, 'disable')"
                  icon="pi pi-cart-minus"
                  severity="warn"
                  :label="$t('components.products.disableTopupButtonLabel')" />
        </div>
        <div v-else-if="productSubscriptionStatus[product.name]?.paymentSystem === 'UNREGISTERED' &&
                        productSubscriptionStatus[product.name]?.paymentProvider === 'UNKNOWN' &&
                        (productSubscriptionStatus[product.name]?.status !== 'ACTIVE' ||
                        productSubscriptionStatus[product.name]?.status !== 'TRIALING')"
             class="button-group">
          <Button @click="selectProduct(product, business.businessId)" icon="pi pi-check"
                  :label="$t('components.products.buyButtonLabel')" />
        </div>
        <div v-else-if="productSubscriptionStatus[product.name]?.product &&
                        productSubscriptionStatus[product.name]?.status === 'EXPIRING'"
             class="button-group">
          <Button @click="reactivateSubscriptionDialog(productSubscriptionStatus[product.name]?.product)"
                  icon="pi pi-undo"
                  :label="$t('components.products.reactivateButtonLabel')" severity="warn" />
        </div>
        <div v-else-if="productSubscriptionStatus[product.name]?.product && (
                        productSubscriptionStatus[product.name]?.status === 'TRIALING' ||
                        productSubscriptionStatus[product.name]?.status === 'ACTIVE')"
             class="button-group">
          <Button @click="cancelSubscriptionDialog(productSubscriptionStatus[product.name]?.product)"
                  icon="pi pi-trash"
                  :label="$t('components.products.cancelButtonLabel')" severity="warn" />
          <Button @click="gotoStripeCustomerPortal()"
                  icon="pi pi-credit-card"
                  :label="$t('components.products.manageSubscriptionLabel')" severity="secondary" />
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
    const langCode = computed(() => Tr.getLocale()) ;
    const { t } = useI18n()
    return {
      t,
      langCode,
      store,
      isWebView,
      business,
      showProgressBar: false,
      session: null,
      user: computed(() => store.state.user),
      products: [],
      productSubscriptionStatus: {}
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
    setTopup(product, businessId, operation) {
      console.debug("Enable Product:", product, businessId) ;
      this.showProgressBar = true ;
      const productName = product.name
      let headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      };
      axios.post(process.env.VUE_APP_STARCHAT_URL +
          `/mrcall/v1/mrcall0/crm/product/onetime/topup/${operation}?id=${businessId}&name=${productName}`,
          {},
          {
            headers: headers
          }
      ).then((response) => {
        this.showProgressBar = false;
        console.log("TOPUP", productName, response.data)
        this.productSubscriptionStatus[productName] = response.data
      }).catch((error) => {
        this.showProgressBar = false;
        if(error.response.status === 404) {
          console.info(`Product not found, businessId(${businessId}), name(productName)`)
        } else if(error.response.status === 401) {
          console.error(error)
          this.store.dispatch('logout')
          router.push('/signin')
        } else {
          this.toast.add({severity:'error',
            summary: `Topup (${productName}): ${operation}`,
            detail: this.t('components.products.toastErrorSummary'), life: 10000})
          console.error(error)
        }
      })
    },
    async createSession(product, businessId) {
      this.showProgressBar = true;
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      };
      const sessionIn = {
        businessId: businessId,
        productId: product.name,
        successUrl: process.env.VUE_APP_SERVICE_BASE_URL + process.env.VUE_APP_PUBLIC_PATH +
            "/success_payment_product?businessId=" + businessId + "&product=" + product.name,
        cancelUrl: process.env.VUE_APP_SERVICE_BASE_URL + process.env.VUE_APP_PUBLIC_PATH +
            "/failed_payment_product?businessId=" + businessId + "&product=" + product.name
      }
      console.log(headers, sessionIn)
      await axios.post(process.env.VUE_APP_STARCHAT_URL + "/stripe/v1/mrcall0/session/product",
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
          router.push('/signin')
        } else {
          this.toast.add({severity:'error',
            summary: this.t('components.products.toastPaymentSubscriptionSummary'),
            detail: this.t('components.products.errorCreatingPaymentData'), life: 10000})
          this.setMessage("error", this.t('components.products.errorCreatingPaymentData'))
        }
      })
    },
    async checkSubscription(businessId, productName, productType) {
      console.debug("checkSubscription:", businessId, productName)
      let headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      };
      axios.get(process.env.VUE_APP_STARCHAT_URL +
          `/mrcall/v1/mrcall0/crm/product/${productType}/status?id=${businessId}&name=${productName}`,
          {
            headers: headers
          }
      ).then((response) => {
        if(response.data) {
          console.log(productName, response.data)
          this.productSubscriptionStatus[productName] = response.data
        } else {
          console.error("Product Subscription data was empty:", response)
        }
      }).catch((error) => {
        if(error.response.status === 404) {
          console.info(`Subscription not found, businessId(${businessId}), name(productName)`)
        } else if(error.response.status === 401) {
          console.error(error)
          this.store.dispatch('logout')
          router.push('/signin')
        } else {
          console.error(error)
        }
      })
    },
    cancelSubscriptionDialog(product) {
      console.debug("Cancel subscription dialog:", product)
      this.showProgressBar = true;
      this.confirm.require({
        message: this.t('components.products.confirmationCancellationRequest'),
        header: this.t('components.products.confirmCancellation'),
        icon: 'pi pi-exclamation-triangle',
        defaultFocus: 'reject',
        accept: () => {
          console.log("Continue with subscription cancelation")
          this.toast.add({severity:'warn', summary: this.t('components.products.toastCancelSubscriptionSummary'),
            detail: this.t('components.products.toastNotifyFortcomingCancelOperation'),
            life: 5000});
          this.cancelSubscription(product)
        },
        reject: () => {
          console.log("Reject of subscription cancel")
          this.toast.add({severity:'info', summary: this.t('components.products.toastCancellingOperationSummary'),
            detail: this.t('components.products.toastNotifyCanceledCancelSubscriptionOperation'),
            life: 5000});
        }
      });
      this.showProgressBar = false;
    },
    cancelSubscription(product) {
      const stripeSubscriptionId = product.objectReferenceId
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      }
      axios.delete(process.env.VUE_APP_STARCHAT_URL +
          `/stripe/v1/mrcall0/subscription?id=${stripeSubscriptionId}&productSource=product`,
          {
            headers: headers
          }
      ).then((response) => {
        this.showProgressBar = false;
        console.debug("Cancel subscription response:", response)
        this.confirm.require({
          message: this.t('components.products.confirmCompletedCancelationSubscriptionSummary'),
          header: this.t('components.products.toastCancelSubscriptionSummary'),
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
        this.toast.add({severity:'error', summary: this.t('components.products.toastCancelSubscriptionSummary'),
          detail: this.t('components.products.toastErrorSummary') + ": " + error, life: 10000})
        if(error.response.status === 401) {
          this.store.dispatch('logout')
          this.router.replace('/signin')
        }
      })
    },
    reactivateSubscriptionDialog(product) {
      console.debug("Reactivate subscription dialog:", product)
      this.showProgressBar = true;
      this.toast.add({severity:'info', summary: this.t('components.products.toastReactivateSubscriptionSummary'),
        detail: this.t('components.products.toastNotifyFortcomingReactivateOperation'),
        life: 5000});
      this.reactivateSubscription(product)
      this.showProgressBar = false;
    },
    reactivateSubscription(product) {
      const stripeSubscriptionId = product.objectReferenceId
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      }
      axios.put(process.env.VUE_APP_STARCHAT_URL +
          `/stripe/v1/mrcall0/subscription?id=${stripeSubscriptionId}&productSource=product`,
          {},
          {
            headers: headers
          }
      ).then((response) => {
        this.showProgressBar = false;
        console.debug("Reactivate subscription response:", response)
        this.confirm.require({
          message: this.t('components.products.confirmCompletedReactivationSubscriptionSummary'),
          header: this.t('components.products.toastReactivateSubscriptionSummary'),
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
        this.toast.add({severity:'error', summary: this.t('components.products.toastReactivateSubscriptionSummary'),
          detail: this.t('components.products.toastErrorSummary') + ": " + error, life: 10000})
        if(error.response.status === 401) {
          this.store.dispatch('logout')
          this.router.replace('/signin')
        }
      })
    },
    async selectProduct(product, businessId) {
      console.debug("Select Product:", product, businessId)
      await this.createSession(product, businessId)
      console.debug("Session:", this.session)
      if(this.session)
        window.location.href = this.session.url // redirect to payment
    },
    setMessage(severity, content) {
      const id = Date.now()
      this.message = {
        id: id,
        severity: severity,
        content: content,
      }
    },
    productList() {
      this.showProgressBar = true;
      let headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      };
      axios.get(process.env.VUE_APP_STARCHAT_URL +
          `/mrcall/v1/mrcall0/crm/product?language=${this.langCode}&template=` + this.business.template,
          {
            headers: headers
          }
      ).then((response) => {
        if(response.data) {
          const businessId = this.business.businessId
          const checkSubscriptionFunction = this.checkSubscription
          response.data
              .map(function(item) {
                checkSubscriptionFunction(businessId, item.name, item.productType)
              })
          this.products = response.data
        }
        this.showProgressBar = false
      }).catch((error) => {
        console.error(error)
        this.showProgressBar = false
        if(error.response.status === 401) {
          this.store.dispatch('logout')
          router.push('/signin')
        }
      })
    }
  },
  mounted () {
    this.productList()
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
</style>