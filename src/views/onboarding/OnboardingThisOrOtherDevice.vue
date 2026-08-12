<template>
  <OnboardingBase>
    <template #before-central>
    </template>
    <template #title>{{ $t('views.onboarding.thisorotherdevice.titleText') }}</template>
    <template #subtitle>{{ $t('views.onboarding.thisorotherdevice.subtitleText') }}</template>
    <template #content>
      <div class="item">
        <a href="javascript:void(0)" @click="selection='this-phone'" target="_self" :class="isSelected('this-phone')">
          <div class="icon-box">
            <div class="this-phone-icon">
            </div>
            <div class="description">
              {{$t('views.onboarding.thisorotherdevice.thisPhone')}}
            </div>
          </div>
        </a>
        <a href="javascript:void(0)" @click="selection='other-phone'" target="_self" :class="isSelected('other-phone')">
          <div class="icon-box">
            <div class="other-phone-icon">
            </div>
            <div class="description">
              {{$t('views.onboarding.thisorotherdevice.otherPhone')}}
            </div>
          </div>
        </a>
      </div>
    </template>
    <template #footer>
      <div class="button-left">
        <Button :label="$t('views.onboarding.thisorotherdevice.moveBackward')"
                @click="router.back()"
                class="p-button-text md:w-auto py-3 w-full p-button-left"/>
      </div>
      <div class="button-right">
        <Button :label="$t('views.onboarding.thisorotherdevice.moveForward')" @click="submit()" class="p-button-text md:w-auto py-3 w-full"/>
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
  name: "OnboardingThisOrOtherDevice",
  setup: function () {
    const store = useStore();
    const onboardingData = computed(() => store.state.onboardingData)
    return {
      store,
      user: computed(() => store.state.user),
      router,
      onboardingData,
      selection: ref("this-phone")
    }
  },
  data: function() {
    return {
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
      const self = this;
      console.log("Submit with: ", this.onboardingData);
      if(this.selection === "this-phone") {
        this.$gtag.event("onboarding_choosedevice", {
          'user_email': self.user.email,
          'device': 'this-phone'
        })
        this.router.push({
          name: "OnboardingForwardingOnThisDevice"
        })
      } else if(this.selection === "other-phone") {
        this.$gtag.event("onboarding_choosedevice", {
          'user_email': self.user.email,
          'device': 'other-phone'
        })
        this.router.push({
          name: "OnboardingForwardingOnOtherDevice"
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
    console.log("ThisOrOtherDevice Called with: ", this.onboardingData);
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

      .this-phone-icon {
        background: url(../../assets/images/mrcall/littleman/little_man_one_phone.svg) no-repeat;
        background-position:center;
        width: 100%;
        height: 4em;
      }

      .other-phone-icon {
        background: url(../../assets/images/mrcall/littleman/little_man_two_phone.svg) no-repeat;
        background-position:center;
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
