<template>
  <div class="min-h-full flex flex-column justify-content-between">
    <div class="success-page-content text-center">
      <div v-if="assignmentOperationCompleted" class="success-container">
        <!-- Success icon -->
        <div class="success-icon-wrapper">
          <i class="pi pi-check-circle success-icon"></i>
        </div>

        <h1 class="success-title">{{ $t('views.successpayment.yourAssistantIsActive') }}</h1>

        <!-- Assigned number prominently displayed -->
        <div v-if="assignedNumber && !alreadyAssignedNumber" class="assigned-number-box">
          <div class="assigned-number-label">{{ $t('views.successpayment.yourNumber') }}</div>
          <div class="assigned-number-value">{{ cleanServiceNumber }}</div>
        </div>

        <!-- Already assigned — go to assistant -->
        <div v-if="alreadyAssignedNumber">
          <p class="info-text">{{ $t('views.successpayment.alreadyAssignedNumber') }}</p>
          <Button @click="router.push('/businesses')"
                  iconPos="right"
                  icon="pi pi-fw pi-arrow-right"
                  :label="$t('views.successpayment.alreadyAssignedNumberButtonLabel')"
                  class="p-button-lg success-cta" />
        </div>

        <!-- New number assigned — set up forwarding -->
        <div v-else-if="assignedNumber" class="action-buttons">
          <Button @click="router.push('/onboardingchoosedevice?id=' + businessId)"
                  iconPos="right"
                  icon="pi pi-fw pi-phone"
                  :label="$t('views.successpayment.setupForwarding')"
                  class="p-button-lg success-cta" />
          <Button @click="router.push('/businesses')"
                  :label="$t('views.successpayment.goToDashboard')"
                  class="p-button-lg p-button-outlined success-secondary" />
        </div>

        <!-- No number assigned — contact support -->
        <div v-else>
          <p class="info-text">{{ $t('views.successpayment.contactSupport') }}</p>
        </div>

        <!-- Business Plus — book appointment -->
        <div v-if="templateName === 'businessplus_onboarding' || templateName === 'businessplus'" class="businessplus-section">
          <Divider />
          <p class="info-text">{{ $t('views.successpayment.bookAnAppointment') }}</p>
          <Button @click="goToPageRoute('/callbooking')"
                  :label="$t('views.successpayment.appointmentButtonText')"
                  class="p-button-outlined" />
        </div>

        <!-- App download -->
        <div v-if="!isWebView" class="app-download-section">
          <Divider />
          <p class="app-text" v-html="$t('views.successpayment.announcementApp')"></p>
          <div class="app-buttons">
            <Button @click="gotoExternalPage('https://play.google.com/store/apps/details?id=ai.mrcall.app')"
                    class="p-button-outlined p-button-sm"
                    iconPos="right"
                    icon="pi pi-fw pi-android" :label="$t('views.successpayment.androidButtonLabel')" />
            <Button @click="gotoExternalPage('https://apps.apple.com/it/app/mrcall/id1638301178')"
                    class="p-button-outlined p-button-sm"
                    iconPos="right"
                    icon="pi pi-fw pi-apple" :label="$t('views.successpayment.appleButtonLabel')" />
          </div>
        </div>
      </div>

      <!-- Loading state -->
      <div v-else class="loading-state">
        <ProgressSpinner
            style="width: 50px; height: 50px;"
            strokeWidth="4"
            :pt="{
              spinner: { style: { animationDuration: '2s' } },
              circle: { style: { stroke: '#0068FF', strokeWidth: 3, animation: 'auto' } }
            }"
            fill="transparent"
            animationDuration="2.5s" aria-label="ProgressSpinner" />
      </div>
    </div>
    <footer id="footer" class="mt-auto">
      <PreFooterRequireAssistance/>
    </footer>
  </div>
</template>

<script>
import router from "@/router";
import {useStore} from "vuex";
import {computed} from 'vue';
import {onAuthStateChanged} from "firebase/auth";
import {auth} from "@/firebase/config";
import PreFooterRequireAssistance from "@/components/PreFooterRequireAssistance";
import businessUtils from "@/utils/Business";

export default {
  components: {PreFooterRequireAssistance},
  setup: function() {
    let businessId = "";
    return {
      businessId
    }
  },
  data: function () {
    const store = useStore()
    let templateNameValue = null
    let assignmentOperationCompletedValue = false
    let assignNumberValue = null
    let alreadyAssignedNumberValue = false
    const isWebView = computed(() => store.state.isWebview)
    return {
      store,
      isWebView,
      user: computed(() => store.state.user),
      assignNumberValue,
      alreadyAssignedNumberValue,
      assignmentOperationCompletedValue,
      templateNameValue,
      router,
      name: "Success payment page"
    }
  },
  computed: {
    assignmentOperationCompleted: {
      get() {
        return this.assignmentOperationCompletedValue
      },
      set(newValue) {
        this.assignmentOperationCompletedValue = newValue
      }
    },
    assignedNumber: {
      get() {
        return this.assignNumberValue
      },
      set(newValue) {
        this.assignNumberValue = newValue
      }
    },
    alreadyAssignedNumber: {
      get() {
        return this.alreadyAssignedNumberValue
      },
      set(newValue) {
        this.alreadyAssignedNumberValue = newValue
      }
    },
    templateName: {
      get() {
        return this.templateNameValue
      },
      set(newValue) {
        this.templateNameValue = newValue
      }
    },
    cleanServiceNumber() {
      return this.assignNumberValue || '';
    }
  },
  methods: {
    updateAssignedNumber() {
      const self = this;
      const businessId = this.$route.query.id;
      businessUtils.getBusiness(this.store, this.user, businessId).then((item) => {
        console.debug("Update assigned number: ", businessId, item, item.serviceNumber);
        self.businessId = businessId
        self.assignedNumber = item.serviceNumber;
        self.templateName = item.template;
        self.assignmentOperationCompleted = true;
      })
    },
    goToPageRoute(route) {
      window.location.href = process.env.VUE_APP_WEBSITE_BASE_URL + route
    },
    gotoExternalPage(url) {
      window.open(url)
    }
  },
  mounted() {
    window.scrollTo(0, 0);
    const businessId = this.$route.query.id;
    if(this.$route.query.template) {
      this.templateNameValue = this.$route.query.template;
    } else {
      this.templateNameValue = 'unknown'
    }
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
          this.$gtag.event("payment_success", {
            'business_id': businessId,
            'user_email': user.email,
            'plan_name': this.templateNameValue,
            'session_reference': sessionReference
          });
          this.updateAssignedNumber()
        }
      })
    } else {
      this.$gtag.event("payment_success", {
        'business_id': businessId,
        'user_email': this.store.state.user.email,
        'plan_name': this.templateNameValue,
        'session_reference': sessionReference
      });
      this.updateAssignedNumber()
    }
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/default';

.success-page-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 2em;
}

.success-container {
  max-width: 600px;
  width: 100%;
}

.success-icon-wrapper {
  margin-bottom: 1em;

  .success-icon {
    font-size: 4em;
    color: #43A047;
  }
}

.success-title {
  font-family: 'Inter', serif;
  font-weight: 700;
  font-size: 2em;
  color: @mrcall_blue;
  margin-bottom: 1em;
}

.assigned-number-box {
  background: fade(@mrcall_blue, 6%);
  border: 2px solid fade(@mrcall_blue, 20%);
  border-radius: 12px;
  padding: 1.2em 1.5em;
  margin: 1.5em auto;
  max-width: 400px;

  .assigned-number-label {
    font-family: 'Inter', serif;
    font-size: 0.85em;
    font-weight: 500;
    color: @mrcall_grey_text;
    margin-bottom: 0.3em;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .assigned-number-value {
    font-family: 'Inter', serif;
    font-size: 1.8em;
    font-weight: 700;
    color: @mrcall_dark_grey_text;
    letter-spacing: 0.02em;
  }
}

.action-buttons {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8em;
  margin-top: 1.5em;
}

.success-cta {
  font-family: 'Inter', serif;
  font-weight: 700;
}

.success-secondary {
  font-family: 'Inter', serif;
  font-weight: 600;
}

.info-text {
  font-family: 'Inter', serif;
  font-size: 1.1em;
  color: @mrcall_grey_text;
  line-height: 1.5;
  margin: 1em 0;
}

.businessplus-section {
  margin-top: 1.5em;
}

.app-download-section {
  margin-top: 1em;

  .app-text {
    font-size: 0.9em;
    color: @mrcall_grey_text;
    margin-bottom: 0.8em;
  }

  .app-buttons {
    display: flex;
    justify-content: center;
    gap: 0.5em;
    flex-wrap: wrap;
  }
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
}

#footer {
  margin-top: auto;
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}
</style>
