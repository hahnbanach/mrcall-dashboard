<template>
  <div class="change-email-form">
    <Dialog
      :modal="true"
      :closable="false"
      :hide="toggleSuccessDialog()"
      :closeOnEscape="false"
      v-model:visible="showMessage"
      :breakpoints="{ '960px': '75vw', '640px': '90vw' }"
      :style="{ width: '30vw' }"
      position="top"
    >
      <div class="p-d-flex p-ai-center p-dir-col p-pt-6 p-px-3">
        <div v-if="error === null">
          <div class="text-center mb-4">
            <i class="pi pi-check-circle response-icon response-icon--success"></i>
          </div>
          <div class="text-center">
            <h5 class="mb-3 font-bold md:text-3xl text-2xl text-center">{{$t('components.changeemail.operationSuccess')}}</h5>
            <p class="response-text">
              {{$t('components.changeemail.operationSuccessExtended')}}
            </p>
          </div>
        </div>
        <div v-else>
          <div class="text-center mb-4">
            <i class="pi pi-times-circle response-icon response-icon--error"></i>
          </div>
          <div class="text-center">
            <h5 class="mb-3 font-bold md:text-3xl text-2xl text-center">{{ $t('components.changeemail.operationFailed') }}</h5>
            <p class="response-text">
              {{$t('components.changeemail.operationFailedExtended')}}: <b>{{email}}</b>: {{error}}
            </p>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="text-center">
          <template v-if="error === null">
            <Button label="OK" @click="toggleDialog" class="px-6 py-3 p-button-text" />
          </template>
          <template v-else>
            <Button label="Dismiss" @click="toggleDialog" class="px-6 py-3 p-button-text"/>
          </template>
        </div>
      </template>
    </Dialog>
    <div class="p-d-flex p-jc-center">
      <div class="card">
        <form @submit.prevent="handleSubmit(!v$.$invalid)" class="p-fluid">
          <div class="p-field">
            <div class="p-field mb-3">
              <IconField>
                <InputText id="email" :placeholder="$t('components.changeemail.changeEmailSubtitle')" v-model="v$.email.$model" :class="{'p-invalid':v$.email.$invalid && submitted}" aria-describedby="email-error" class="pl-4 text-sm"/>
                <InputIcon class="pi pi-envelope pr-4 text-lg" />
              </IconField>
              <span class="ml-3" v-if="v$.email.$error && submitted">
                  <span id="email-error" v-for="(error, index) of v$.email.$errors" :key="index">
                  <small class="p-error">{{error.$message}}</small>
                  </span>
              </span>
              <small v-else-if="(v$.email.$invalid && submitted) || v$.email.$pending.$response" class="p-error">{{v$.email.required.$message.replace('Value', 'Email')}}</small>
            </div>
          </div>
          <div class="text-center">
            <Button type="submit" :label="$t('components.changeemail.submitButton')" class="p-mt-2 md:w-auto py-3 px-6 w-full" />
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import {email, required} from "@vuelidate/validators"
import {useVuelidate} from "@vuelidate/core"
import {verifyBeforeUpdateEmail} from "firebase/auth";
import {useRouter} from 'vue-router'
import {useStore} from 'vuex'

export default {
  setup() {
    const v$ = useVuelidate()
    const router = useRouter()
    const store = useStore()
    return {
      v$,
      store,
      router
    }
  },
  data() {
    return {
      email: '',
      error: null,
      enabledLogout: false,
      submitted: false,
      showMessage: false
    }
  },
  validations() {
    return {
      email: {
        required,
        email
      }
    }
  },
  created() {
  },
  mounted() {
  },
  methods: {
    async handleSubmit(isFormValid) {
      const self = this ;
      self.submitted = true;

      if (!isFormValid) {
        return;
      }

      verifyBeforeUpdateEmail(self.store.state.user, self.email).then(() => {
        console.debug("Email link successfully sent")
        self.enabledLogout = true ;
      }).catch((error) => {
        self.error = error.message
      });


      self.toggleDialog();
    },
    toggleSuccessDialog() {
      console.log(this.enabledLogout, this.submitted, this.showMessage)
      if(this.enabledLogout && ! this.submitted && ! this.showMessage) {
        this.store.dispatch('logout')
        this.router.replace('/')
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
      this.error = null ;
      this.submitted = false;
    }
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';

.response-icon {
  font-size: 3rem;

  &--success {
    color: @mrcall_status_success;
  }

  &--error {
    font-size: 5rem;
    color: @mrcall_status_error;
  }
}

.response-text {
  line-height: 1.5;
  text-indent: 1rem;
}

.change-email-form {
  .card {
    width: auto;

    .p-field {
      margin-bottom: 1.5rem;
    }
  }
}
</style>
