<template>
  <div class="signin-signup-form">
    <form @submit.prevent="handleSubmit(!v$.$invalid)">
      <div class="p-fluid">
        <div class="p-field">
          <div class="inputboxtitle">
            {{$t('components.templates.sign.signin.emailInputboxTitle')}}
          </div>
          <IconField>
            <InputText id="email" :placeholder="$t('components.templates.sign.signin.emailInputboxPlaceholder')" v-model="v$.email.$model" :class="{'p-invalid':v$.email.$invalid && submitted}" aria-describedby="email-error" class="pl-4 text-sm" />
            <InputIcon class="pi pi-envelope pr-4 text-lg" />
          </IconField>
          <span class="ml-3" v-if="v$.email.$error && submitted">
            <span id="email-error" v-for="(error, index) of v$.email.$errors" :key="index">
              <small class="p-error">{{error.$message}}</small>
            </span>
          </span>
          <small v-else-if="(v$.email.$invalid && submitted) || v$.email.$pending.$response" class="p-error">{{v$.email.required.$message.replace('Value', 'Email')}}</small>
        </div>

        <div class="p-field">
          <div class="inputboxtitle">
            {{$t('components.templates.sign.signin.passwordInputboxTitle')}}
          </div>
          <Password id="password" :placeholder="$t('components.templates.sign.signin.passwordInputboxPlaceholder')" v-model="v$.password.$model" :class="{'p-invalid':v$.password.$invalid && submitted}" :feedback="false" :toggleMask="true" class="text-sm">
            <template #header>
              <h6>Pick a password</h6>
            </template>
          </Password>
          <small v-if="(v$.password.$invalid && submitted) || v$.password.$pending.$response" class="ml-3 p-error">
            <div v-for="error in v$.password.$errors" :key="error">
              {{ error.$message.replace('Value', 'Password') }}
            </div>
          </small>
        </div>
      </div>

      <div class="p-field mb-3">
        <router-link to="/magiclink" class="link">{{ $t('components.templates.sign.signin.didYouForgetPassword') }}</router-link>
      </div>

      <div class="p-field mb-3">
        <Button class="signin-signup-button-text" type="submit" :label="$t('components.templates.sign.signin.loginButtonLabel')" />
      </div>

      <div class="divider">
        <span>{{ t('utils.common.or') }}</span>
      </div>

      <div class="p-field mb-3">
        <GoogleSignIn />
      </div>
    </form>

    <!-- Keep the Dialog -->
    <Dialog :modal="true" :closable="false" :closeOnEscape="false" v-model:visible="showMessage" :breakpoints="{ '960px': '80vw' }" :style="{ width: '40vw' }" position="top">
      <div class="p-d-flex p-ai-center p-dir-col p-pt-6 p-px-3">
        <div v-if="errorDialogTitle !== null">
          <div class="text-center mb-4">
            <i class="pi pi-check-circle" :style="{fontSize: '5rem', color: 'red' }"></i>
          </div>

          <div class="text-center">
            <h5 class="mb-3 font-bold md:text-3xl text-2xl text-center">{{errorDialogTitle}}</h5>
            <div v-if="errorType === 'EMAIL_NOT_VERIFIED'">
              <p :style="{lineHeight: 1.5, textIndent: '1rem'}">
                {{errorDialogTextBefore}}: <b>{{email}}</b>
                <br>
                {{errorDialogTextAfter}}
              </p>
              <p class="title">
                <Button :label="$t('components.templates.sign.signin.emailNotVerifiedReSendEmail')" @click="handleResendVerification()" class="p-button-text md:w-auto py-3 px-6 w-full"/>
              </p>
            </div>
            <div v-else-if="errorType === 'USER_NOT_FOUND'">
              <p :style="{lineHeight: 1.5, textIndent: '1rem'}">
                {{errorDialogTextBefore}}: <b>{{email}}</b>
                <br>
                {{errorDialogTextAfter}}
              </p>
              <p class="title">
                <Button :label="$t('components.templates.sign.signin.signupButtonLabel')" @click="router.replace('/signup')" class="p-button-text md:w-auto py-3 px-6 w-full"/>
              </p>
            </div>
            <div v-else>
              <p :style="{lineHeight: 1.5, textIndent: '1rem'}">
                {{errorDialogTextBefore}}: <b>{{email}}</b>
                <br>
                {{errorDialogTextAfter}}
              </p>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <template v-if="errorDialogTextBefore !== null">
          <div class="text-center">
            <Button :label="$t('components.templates.sign.signin.dismissButtonLabel')" @click="toggleDialog" class="p-button-text md:w-auto py-3 px-6 w-full"/>
          </div>
        </template>
      </template>
    </Dialog>
  </div>
</template>

<style scoped lang="less">
@import "../../../assets/style/colors";
@import '../../../assets/style/components/templates/sign/login';
</style>

<script>
import {email, minLength, required} from "@vuelidate/validators"
import {useVuelidate} from "@vuelidate/core"
import {useRouter} from 'vue-router'
import {useStore} from 'vuex'
import {onAuthStateChanged} from "firebase/auth";
import {auth} from "@/firebase/config";
import {useI18n} from "vue-i18n";
import Tr from "@/i18n/translation";
import GoogleSignIn from './GoogleSignIn.vue'
import businessUtils from "@/utils/Business"

export default {
  components: {
    GoogleSignIn
  },
  setup() {
    const v$ = useVuelidate()
    const router = useRouter()
    const store = useStore()
    const { t } = useI18n()
    return {
      t,
      v$,
      store,
      router
    }
  },
  data() {
    return {
      email: '',
      password: '',
      errorType: '',
      errorDialogTitle: null,
      errorDialogTextBefore: null,
      errorDialogTextAfter: null,
      submitted: false,
      showMessage: false
    }
  },
  validations() {
    return {
      email: {
        required,
        email
      },
      password: {
        required,
        minLengthValue: minLength(8),
      }
    }
  },
  created() {
  },
  async mounted() {
    console.debug("Signin component mounted");
    console.debug("Initial user state:", this.store.state.user);
    
    // Check if redirected due to session expiry
    if (this.$route.query.session_expired) {
      this.errorDialogTitle = this.t('components.templates.sign.signin.sessionExpiredTitle')
      this.errorDialogTextBefore = this.t('components.templates.sign.signin.sessionExpiredMessage')
      this.toggleDialog()
    }
    
    const lang = this.$route.query?.lang;
    if(lang) {
      Tr.switchLanguage(lang)
    }

    const redirectString = this.$route.query?.redirect ;
    let redirect = undefined ;
    if(redirectString) {
      const redirectJsonString = decodeURIComponent(redirectString)
      redirect = JSON.parse(redirectJsonString)
      console.debug("Login: redirect parameters: ", redirect)
    }

    const confirmEmail = this.$route.query.confirm_email;
    const signin = this.$route.query.signin || this.$route.query.mode === "signIn";
    console.debug("ConfirmEmailMode: ", confirmEmail, signin, this.store.state.user);
    if(! this.store.state.user && !(signin || confirmEmail)) {
      onAuthStateChanged(auth, (user) => {
        console.debug("Auth state changed:", user);
        if(user) {
          console.debug("User is logged in, email verified:", user.emailVerified);
          console.debug("StatusChanged, reloading user: ", user)
          user.reload().then(() => {
            console.log("NewUser: ", this.store.state.user)
          })
          console.debug("Submitting login event: ", user)
          this.$gtag.event("login", {
            'user_email': user.email,
          })
          user.getIdToken(true).then((token) => {
            console.debug("NewToken: ", token)
            if(redirect) {
              this.router.replace({path: redirect.path, query: redirect.query})
            } else if(this.store.state.user?.emailVerified) {
              this.redirectAfterAuth();
            }
          })
        }
      })
    } else if((signin || confirmEmail) && await this.store.dispatch('completeEmailLinkSignIn', {})) {
      const email = this.$route.query.email;
      console.debug("Signup, confirmEmail: ", signin, confirmEmail);
      if(signin) {
        console.debug("Submitting login with magiclink event: ", email)
        this.$gtag.event("login", {
          'user_email': email,
          'mode': 'magiclink'
        })
      } else { //if(confirmEmail)
        console.debug("Submitting verified_email event: ", this.store.state.user)
        this.$gtag.event("verified_email", {
          'user_email': this.store.state.user?.email,
        })
      }
      if(redirect) {
        this.router.replace({path: redirect.path, query: redirect.query})
      } else if(this.store.state.user?.emailVerified) {
        this.redirectAfterAuth(true);
      }
    } else {
      onAuthStateChanged(auth, (user) => {
        console.debug("Auth state changed:", user);
        if(user) {
          console.debug("User is logged in, email verified:", user.emailVerified);
          console.debug("StatusChanged, reloading user: ", user)
          user.reload().then(() => {
            console.log("NewUser: ", this.store.state.user)
          })
          if(confirmEmail) {
            console.debug("Submitting verified_email event: ", this.store.state.user)
            this.$gtag.event("verified_email", {
              'user_email': this.store.state.user?.email,
            })
          }
          user.getIdToken(true).then((token) => {
            console.debug("NewToken: ", token)
            if(redirect) {
              this.router.replace({path: redirect.path, query: redirect.query})
            } else if(this.store.state.user?.emailVerified) {
              this.redirectAfterAuth();
            }
          })
        }
      })
    }
  },
  methods: {
    async redirectAfterAuth(useReplace = false) {
      try {
        const hasBusinesses = await businessUtils.checkUserHasBusinesses(this.store.state.user, this.store);
        const path = hasBusinesses ? '/businesses' : '/onboardinglang';
        if (useReplace) {
          this.router.replace(path);
        } else {
          this.router.push(path);
        }
      } catch (error) {
        console.error('Error checking user status:', error);
        this.router.push('/onboardinglang');
      }
    },
    async handleResendVerification() {
      try {
        console.debug("Calling store dispatch: emailLinkSignup")
        const cleanEmail = this.email.replace(" ", "")
        await this.store.dispatch('resendEmailVerification', {
          email: cleanEmail,
        })
        this.toggleDialog();
      } catch (err) {
        this.error = err.message
      }
    },
    async handleSubmit(isFormValid) {
      this.submitted = true;
      if (!isFormValid) {
        console.debug("Form validation failed");
        return;
      }
      try {
        console.debug("Attempting login with email:", this.email);
        await this.store.dispatch('login', {
          email: this.email,
          password: this.password
        })
        
        console.debug("Login successful, user:", this.store.state.user);
        
        // Add more detailed logging for the email verification check
        if(this.store.state.user) {
          console.debug("Email verified status:", this.store.state.user.emailVerified);
          if(!this.store.state.user.emailVerified) {
            console.debug("Email not verified, showing dialog");
            this.errorDialogTitle = this.t('components.templates.sign.signin.emailNotVerifiedTitle');
            this.errorDialogTextBefore = this.t('components.templates.sign.signin.emailNotVerifiedFirstPart');
            this.errorDialogTextAfter = this.t('components.templates.sign.signin.emailNotVerifiedSecondPart');
            this.errorType = "EMAIL_NOT_VERIFIED";
            this.toggleDialog();
          } else {
            console.debug("Email verified, should redirect to /businesses");
          }
        }
      } catch (err) {
        console.error("Login error:", err);
        if(err.message.includes("auth/user-not-found")) {
          this.errorDialogTitle = this.t('components.templates.sign.signin.loginFailedUserNotFoundTitle')
          this.errorDialogTextBefore = this.t('components.templates.sign.signin.loginFailedUserNotFoundMessageFirstPart')
          this.errorDialogTextAfter = this.t('components.templates.sign.signin.loginFailedUserNotFoundMessageSecondPart')
          this.errorType = "USER_NOT_FOUND"
        } else if(err.message.includes("auth/invalid-credential")) {
          this.errorDialogTitle = this.t('components.templates.sign.signin.loginFailedWrongPasswordTitle')
          this.errorDialogTextBefore = this.t('components.templates.sign.signin.loginFailedWrongPasswordMessageFirstPart')
          this.errorDialogTextAfter = this.t('components.templates.sign.signin.loginFailedWrongPasswordMessageSecondPart')
          this.errorType = "INVALID_CREDENTIALS"
        } else if(err.message.includes("auth/wrong-password")) {
          this.errorDialogTitle = this.t('components.templates.sign.signin.loginFailedWrongPasswordTitle')
          this.errorDialogTextBefore = this.t('components.templates.sign.signin.loginFailedWrongPasswordMessageFirstPart')
          this.errorDialogTextAfter = this.t('components.templates.sign.signin.loginFailedWrongPasswordMessageSecondPart')
          this.errorType = "WRONG_PASSWORD"
        } else if(err.message.includes("auth/network-request-failed")) {
          this.errorDialogTitle = this.t('components.templates.sign.signin.loginFailedNetworkErrorTitle')
          this.errorDialogTextBefore = this.t('components.templates.sign.signin.loginFailedNetworkErrorMessageFirstPart')
          this.errorDialogTextAfter = this.t('components.templates.sign.signin.loginFailedNetworkErrorMessageSecondPart')
          this.errorType = "NETWORK_ERROR"
        } else {
          this.errorDialogTitle = this.t('components.templates.sign.signin.loginFailedGenericTitle')
          this.errorDialogTextBefore = this.t('components.templates.sign.signin.loginFailedWithEmail')
          this.errorDialogTextAfter = err.message
        }

        this.toggleDialog();
      }
    },
    toggleDialog() {
      this.showMessage = !this.showMessage;

      if(!this.showMessage) {
        this.resetForm();
      }
    },
    resetForm() {
      this.email = '';
      this.password = '';
      this.errorType = '';
      this.errorDialogTitle = null ;
      this.errorDialogTextBefore = null ;
      this.errorDialogTextAfter = null ;
      this.submitted = false;
    }
  }
}
</script>