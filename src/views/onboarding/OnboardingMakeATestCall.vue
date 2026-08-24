<template>
  <OnboardingBase :current-step="3" :total-steps="3">
    <template #spinner>
      <Toast></Toast>
      <ProgressSpinner
        v-show="showSpinner"
        style="
          position: fixed;
          top: 50%;
          transform: translate(0%, -50%);
          width: 25%;
          height: 20%;
          z-index: 100;
        "
        strokeWidth="4"
        :pt="{
          spinner: { style: { animationDuration: '2s' } },
          circle: {
            style: { stroke: '#0068FF', strokeWidth: 3, animation: 'auto' },
          },
        }"
        fill="transparent"
        animationDuration="2.5s"
        aria-label="ProgressSpinner"
      />
    </template>
    <template #title>
      <div id="makeatestcall-icon"></div>
      {{ $t("views.onboarding.makeatestcall.titleText") }}
    </template>
    <template #subtitle>{{
      $t("views.onboarding.makeatestcall.tryAssistantWithWebcallOrPhone")
    }}</template>
    <template #content>
      <Dialog
        v-model:visible="modalDialogVisible"
        :dismissableMask="false"
        :closable="false"
        modal
      >
        <div class="modal_dialog_content">
          <div :class="'modal_dialog_icon' + ' ' + modalDialogIconClass"></div>
          <div class="modal_dialog_title">
            <div v-for="item in modalDialogTitle" :key="item">
              {{ item }}
            </div>
          </div>
          <div v-if="modalDialogSubTitle" class="modal_dialog_subtitle">
            {{ modalDialogSubTitle }}
          </div>
          <div class="modal_dialog_message">
            <div
              v-if="modalDialogBodyMessage"
              v-for="item in modalDialogBodyMessage"
              :key="item"
              style="line-height: 1.5em"
            >
              {{ item }}
            </div>
            <div v-else-if="modalDialogNoTestCallMessage">
              <div class="modal_dialog_no_testcall_title">
                {{
                  $t(
                    "views.onboarding.makeatestcall.modalDialogNoTestCallBodyMessageTitle"
                  )
                }}
              </div>
              <ul>
                <li>
                  {{
                    $t(
                      "views.onboarding.makeatestcall.modalDialogNoTestCallBodyMessage1"
                    )
                  }}: {{ onboardingData.business.businessPhoneNumber }}
                </li>
                <li>
                  {{
                    $t(
                      "views.onboarding.makeatestcall.modalDialogNoTestCallBodyMessage2_1"
                    )
                  }}
                  <a
                    :href="
                      'tel:' +
                      $t(
                        'views.onboarding.makeatestcall.modalDialogNoTestCallBodyMessageSupportNumber'
                      )
                    "
                    target="_self"
                  >
                    {{
                      $t(
                        "views.onboarding.makeatestcall.modalDialogNoTestCallBodyMessageSupportNumber"
                      )
                    }}
                  </a>
                  {{
                    $t(
                      "views.onboarding.makeatestcall.modalDialogNoTestCallBodyMessage2_2"
                    )
                  }}
                  <a href="mailto:support@mrcall.ai">support@mrcall.ai</a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <template #footer>
          <div class="modal-dialog-footer">
            <div v-if="modalDialogLeftButtonLabel" class="button-left">
              <Button
                :label="modalDialogLeftButtonLabel"
                @click="resetErrorMessage(modalDialogLeftRedirectComponentName)"
                class="p-button-text md:w-auto py-3 w-full p-button-left"
              />
            </div>
            <div v-if="modalDialogRightButtonLabel" class="button-right">
              <Button
                :label="modalDialogRightButtonLabel"
                @click="
                  resetErrorMessage(modalDialogRightRedirectComponentName)
                "
                class="p-button-text md:w-auto py-3 w-full"
              />
            </div>
          </div>
        </template>
      </Dialog>
      <div class="item">
        <div class="webcallbutton full">
          <WebcallButton
            v-if="user && businessId && isAdmin"
            :username="undefined"
            :password="undefined"
            :business-id="businessId"
            :authtoken="user.accessToken"
            :userid="user.id"
            class="p-button-text md:w-auto py-3 full"
            icon="pi pi-phone"
            labelCall="Test webcall (alpha)"
            labelHangup="Hangup webcall"
          />
        </div>
        <div class="webcallbutton full" style="margin-top: 0.5em">
          <!-- ONE button, and the encoding is a capability question — see
               @/utils/VoiceEncoding. There used to be two: Opus behind isAdmin
               and uncompressed pcm16 for everyone else, which put customers on
               ~16x the bandwidth of the path the product was being judged on. -->
          <DirectVoiceButton
            v-if="user && businessId"
            :business-id="businessId"
            :encoding="voiceEncoding"
            class="md:w-auto py-3 full"
            labelHangup="Hangup direct voice"
          />
        </div>
      </div>
      <!-- trial-reminder removed: no payment at this stage -->
    </template>
    <template #footer>
      <div class="button-left">
        <Button
          :label="$t('views.onboarding.makeatestcall.skipGoToDashboard')"
          @click="goToDashboard()"
          class="p-button-text md:w-auto py-3 w-full p-button-left"
        />
      </div>
      <div class="button-right">
        <Button
          :label="$t('views.onboarding.makeatestcall.moveForward')"
          @click="goToDashboard()"
          class="p-button-text md:w-auto py-3 w-full"
        />
      </div>
    </template>
  </OnboardingBase>
</template>

<script>
import OnboardingBase from "@/components/templates/onboarding/Base";
import { computed, ref } from "vue";
import { useStore } from "vuex";
import router from "@/router";
import Autocomplete from "primevue/autocomplete";
import { useConfirm } from "primevue/useconfirm";
import businessUtils from "@/utils/Business";
import conversationUtils from "@/utils/Conversation";
import { useI18n } from "vue-i18n";
import WebcallButton from "@/components/webcall/WebcallButton.vue";
import DirectVoiceButton from "@/components/webcall/DirectVoiceButton.vue";
import { preferredVoiceEncoding } from "@/utils/VoiceEncoding";

export default {
  components: {
    OnboardingBase,
    Autocomplete,
    WebcallButton,
    DirectVoiceButton,
  },
  name: "OnboardingMakeATestCall",
  setup: function () {
    const store = useStore();
    const user = computed(() => store.state.user);
    const confirm = useConfirm();
    const onboardingData = computed(() => store.state.onboardingData);
    const { t, tm } = useI18n();
    const isWebView = computed(() => store.state.isWebview);
    const osName = computed(() => store.state.webviewOsName);
    const isAdmin = computed(() => store.state.role === "admin");
    const voiceEncoding = preferredVoiceEncoding();

    return {
      voiceEncoding,
      t,
      tm,
      store,
      user,
      router,
      confirm,
      isWebView,
      osName,
      isAdmin,
      onboardingData,
      businessId: ref(null),
    };
  },
  data: function () {
    return {
      showSpinner: false,
      assistantHasBeenTested: false,
      modalDialogVisible: ref(false),

      modalDialogTitle: null,
      modalDialogIconClass: null,
      modalDialogSubTitle: null,
      modalDialogBodyMessage: null,
      modalDialogLeftButtonLabel: null,
      modalDialogRightButtonLabel: null,
      modalDialogLeftRedirectComponentName: null,
      modalDialogRightRedirectComponentName: null,

      modalDialogNoTestCallMessage: false,
    };
  },
  methods: {
    resetErrorMessage(redirectComponent) {
      console.debug("ResetErrorMessage: ", redirectComponent);
      this.modalDialogVisible = false;
      this.modalDialogTitle = null;
      this.modalDialogSubTitle = null;
      this.modalDialogBodyMessage = null;
      this.modalDialogLeftButtonLabel = null;
      this.modalDialogRightButtonLabel = null;
      this.modalDialogLeftRedirectComponentName = null;
      this.modalDialogRightRedirectComponentName = null;
      this.modalDialogNoTestCallMessage = false;
      this.modalDialogIconClass = "error-icon";
      if (redirectComponent) {
        this.router.push({
          name: redirectComponent,
        });
      }
    },
    retrieveLastConversation(businessId) {
      const convQuery = {
        businessId: businessId,
        lightweight: false,
        from: 0,
        size: 1,
      };
      return conversationUtils
        .conversations(this.user, convQuery)
        .then((conv) => {
          return conv;
        })
        .catch((error) => {
          console.debug("Error retrieving conversation", error.response);
          return {};
        });
    },
    goToDashboard() {
      const self = this;
      if (self.osName === "ios") {
        window.flutter_inappwebview.callHandler("onMrCallWebCallback", "exit");
      } else {
        self.router.push({
          name: "Businesses",
        });
      }
    },
    testNumber() {
      return this.onboardingData.business?.variables[
        "ASSISTANT_LANG_SPECIFIC_NUMBER"
      ];
    },
    testServiceNumber() {
      return this.onboardingData.business?.serviceNumber || "";
    },
    testBusinessNumber() {
      return this.onboardingData.business?.businessPhoneNumber;
    },
    async initializePage() {
      const businessId = this.$route.query?.id;
      if (businessId) {
        try {
          const item = await businessUtils.getBusiness(this.store, this.user, businessId);
          if (!item) {
            console.error("Business not found — redirecting to dashboard");
            this.router.push({ name: "Businesses" });
            return;
          }
          console.debug("Business: ", item);
          this.store.state.onboardingData = {
            business: item,
            onboardingRecover: true,
          };
        } catch (e) {
          console.error("Failed to load business — redirecting to dashboard", e);
          this.router.push({ name: "Businesses" });
          return;
        }
      }
    },
  },
  async mounted() {
    if (this.$route.query?.id) {
      this.businessId = this.$route.query?.id;
    } else {
      this.businessId = this.onboardingData?.business?.businessId;
    }
    if (!this.businessId) {
      console.error("No businessId available — redirecting to dashboard");
      this.router.push({ name: "Businesses" });
      return;
    }
    this.onboardingData.lastConversation = undefined;
    await this.initializePage();
  },
  created() {
    console.log("MakeATestCall Called with: ", this.onboardingData);
  },
};
</script>

<style scoped lang="less">
@import "../../assets/style/colors";
@import "../../assets/style/components/templates/onboarding";
@import "../../assets/style/components/templates/onboarding_modal_dialog";

#makeatestcall-icon {
  background: url("../../assets/images/mrcall/icons/make_a_test_call.svg")
    no-repeat;
  background-size: contain;
  width: 3em;
  height: 3em;
  margin: 0 auto 0 auto;
}

.phone-number-box {
  display: flex;
  flex-direction: row;
  background: @mrcall_background;
  margin: 0.5em auto;
  padding: 0.75em;

  .phone-icon {
    background: url("../../assets/images/mrcall/icons/phone_icon.svg") no-repeat;
    width: 1.5em;
    height: 1.5em;
    margin: 0 1em 0 auto;
  }

  .phone-number {
    font-family: "Inter", serif;
    font-style: normal;
    font-weight: 700;
    font-size: 1.2em;
    line-height: 1em;
  }
}

.trial-reminder {
  display: flex;
  align-items: center;
  gap: 0.6em;
  background: fade(@mrcall_blue, 6%);
  border: 1px solid fade(@mrcall_blue, 20%);
  border-radius: 6px;
  padding: 0.8em 1em;
  margin: 1em auto 0 auto;
  font-size: 0.85em;
  color: @mrcall_blue;
  font-weight: 500;
  line-height: 1.4;

  .pi-info-circle {
    font-size: 1.1em;
    flex-shrink: 0;
  }
}

.webcallbutton {
  margin: auto;
}

.inputboxtitle {
  margin: 0 auto 0 auto;
}

.inputboxsubtitle {
  margin: 0 auto 0 auto;
}

.modal_dialog_no_testcall_title {
  margin: 0 0 1em 0;
  font-family: "Inter", serif;
  font-style: normal;
  font-weight: 700;
  font-size: 1.1em;
}

ul {
  display: block;
  li {
    font-family: "Inter", serif;
    font-style: normal;
    font-weight: 700;
    font-size: 0.8em;
    margin: 1em 0 1em 0;
  }
}
</style>
