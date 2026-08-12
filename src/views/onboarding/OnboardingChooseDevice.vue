<template>
  <OnboardingBase>
    <template #before-central>
      <Message v-if="showtrialmessage" severity="success" :closable="false">
        <div>{{$t('views.onboarding.choosedevice.headingMessageTitle')}}</div>
        <div>{{$t('views.onboarding.choosedevice.headingMessageSubtitle')}}</div>
      </Message>
    </template>
    <template #title>{{ $t('views.onboarding.choosedevice.titleText') }}</template>
    <template #subtitle>{{ $t('views.onboarding.choosedevice.subtitleText') }}</template>
    <template #content>
      <div class="item">
        <a href="javascript:void(0)" @click="selection='mobile'" target="_self" :class="isSelected('mobile')">
          <div class="icon-box">
            <div class="mobile-icon">
            </div>
            <div class="description">
              {{$t('views.onboarding.choosedevice.mobilePhone')}}
            </div>
          </div>
        </a>
        <a href="javascript:void(0)" @click="selection='landline'" target="_self" :class="isSelected('landline')">
          <div class="icon-box">
            <div class="landline-icon">
            </div>
            <div class="description">
              {{$t('views.onboarding.choosedevice.landLine')}}
            </div>
          </div>
        </a>
        <a href="javascript:void(0)" @click="selection='switchboard'" target="_self" :class="isSelected('switchboard')">
          <div class="icon-box">
            <div class="switchboard-icon">
            </div>
            <div class="description">
              {{$t('views.onboarding.choosedevice.switchBoard')}}
            </div>
          </div>
        </a>
      </div>
    </template>
    <template #footer>
      <div v-if="enableBackwardButton" class="button-left">
        <Button :label="$t('views.onboarding.choosedevice.moveBackward')"
                @click="router.back()"
                class="p-button-text md:w-auto py-3 w-full p-button-left"/>
      </div>
      <div v-else class="button-left">
      </div>
      <div class="button-right">
        <Button :label="$t('views.onboarding.choosedevice.moveForward')" @click="submit()" class="p-button-text md:w-auto py-3 w-full"/>
      </div>
    </template>
  </OnboardingBase>
</template>

<script>
import OnboardingBase from "@/components/templates/onboarding/Base";
import {computed, ref} from "vue";
import router from "@/router";
import {useStore} from "vuex";
import businessUtils from "@/utils/Business";
import {onAuthStateChanged} from "firebase/auth";
import {auth} from "@/firebase/config";

export default {
  components: {OnboardingBase},
  name: "OnboardingChooseDevice",
  setup: function () {
    const store = useStore();
    const onboardingData = computed(() => store.state.onboardingData)
    const isWebView = computed(() => store.state.isWebview) ;
    const isMobile = computed(() =>
            (screen.width <= 640) || (window.matchMedia &&
                window.matchMedia('only screen and (max-width: 640px)').matches
            )
    ) ;

    return {
      store,
      isMobile,
      isWebView,
      user: computed(() => store.state.user),
      router,
      onboardingData,
      selection: ref("mobile"),
      enableBackwardButton: ref(false),
    }
  },
  data: function() {
    let showtrialmessage = false ;

    return {
      showtrialmessage,
    }
  },
  methods: {
    isSelected(selectedValue) {
      if(selectedValue === this.selection) {
        return "selected-item"
      }
      return "not-selected-item";
    },
    submit() {
      console.log("Submit with: ", this.onboardingData, this.isMobile, this.isWebView);
      const self = this;
      if(this.selection === "mobile") {
        if(this.isMobile || this.isWebView) {
          this.$gtag.event("onboarding_choosedevice", {
            'user_email': self.user.email,
            'device': 'mobile',
            'selection': 'mobile'
          })
          this.router.push({
            name: "OnboardingThisOrOtherDevice"
          })
        } else {
          this.$gtag.event("onboarding_choosedevice", {
            'user_email': self.user.email,
            'device': 'desktop',
            'selection': 'mobile'
          })
          this.router.push({
            name: "OnboardingForwardingOnOtherDevice"
          })
        }
      } else if(this.selection === "landline") {
        this.$gtag.event("onboarding_choosedevice", {
          'user_email': self.user.email,
          'selection': 'landline'
        })
        this.router.push({
          name: "OnboardingForwardingOnLandline"
        })
      } else if(this.selection === "switchboard") {
        this.$gtag.event("onboarding_choosedevice", {
          'user_email': self.user.email,
          'selection': 'switchboard'
        })
        this.router.push({
          name: "OnboardingSwitchboardConfiguration"
        })
      }
    },
    initializePage() {
      const self = this;
      if (!self.onboardingData?.business?.languageCountry) {
        const businessId = this.$route.query?.id;
        if(businessId) {
          businessUtils.getBusiness(this.store, this.user, businessId).then((item) => {
            console.debug("Business: ", item);
            if(item.subscriptionStatus === "TRIALING") {
              self.showtrialmessage = true;
            }
            self.store.state.onboardingData = {
              business: item
            }
          })
        } else {
          router.push({
            name: "Businesses"
          });
        }
      } else {
        if(self.store.state.onboardingData.business?.subscriptionStatus === "TRIALING") {
          self.showtrialmessage = true;
        }

        if(self.store.state.onboardingData?.enableBackwardButton) {
          self.enableBackwardButton = self.store.state.onboardingData.enableBackwardButton ;
        }
      }
    }
  },
  mounted() {
    const self = this;
    if(! self.store.state.user) {
      onAuthStateChanged(auth, (user) => {
        if (user && user.emailVerified && !user.isAnonymous) {
          console.debug("UserStateChanged:", user)
          self.initializePage();
        }
      })
    } else {
      self.initializePage();
    }
  },
  created() {
    console.log("ChooseDevice Called with: ", this.onboardingData);
  }
}
</script>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/components/templates/onboarding';

.item {
  position: relative;
  margin: 0;
  padding: 0;

  margin-top: auto;
  margin-bottom: auto;

  .p-component {
    width: 100%;
  }

  .selected-item {
    border-color: @mrcall_blue;
    border-style: solid;
  }

  .not-selected-item {
    border-color: @mrcall_light_grey_1;
  }

  a {
    width: 9em;
    border-radius: 6px;
    border-width: thin;
    margin-left: auto;
    margin-right: auto;

    .icon-box {
      padding: 1em;

      .landline-icon {
        background: url(../../assets/images/mrcall/icons/which_device_landline.svg) no-repeat;
        background-position: center;
        width: 100%;
        height: 4em;
      }

      .mobile-icon {
        background: url(../../assets/images/mrcall/icons/which_device_mobile.svg) no-repeat;
        background-position: center;
        width: 100%;
        height: 4em;
      }

      .switchboard-icon {
        background: url(../../assets/images/mrcall/icons/which_device_switchboard.svg) no-repeat;
        background-position: center;
        width: 100%;
        height: 4em;
      }

      .description {
        padding-top: 2em;
        font-family: 'Inter', serif;
        font-style: normal;
        font-weight: 800;
        font-size: 0.8em;
        text-align: center;
      }
    }
  }

  a:link {
    text-decoration: none;
    color: @mrcall_black;
  }

  a:visited {
    text-decoration: none;
    color: @mrcall_black;
  }

  a:hover {
    text-decoration: none;
    color: @mrcall_black;
    border-color: @mrcall_blue;
  }

  a:active {
    text-decoration: none;
    color: @mrcall_black;
  }
}

@media screen and (max-width: 640px) {
  .item {
    flex-direction: column;
    margin-top: 1em;
    a {
      margin-bottom: 0.5em;
    }
  }
}

@media screen and (min-width: 640px) {
  .item {
    flex-direction: row;
    a {
    }
  }
}
</style>
