<template>
  <div class="change-password-form">
    <Dialog
      :modal="true"
      :closable="false"
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
            <h5 class="mb-3 font-bold md:text-3xl text-2xl">{{$t('components.changepassword.operationSuccess')}}</h5>
            <p class="response-text">
              {{$t('components.changepassword.operationSuccessExtended')}}
            </p>
          </div>
        </div>
        <div v-else>
          <div class="text-center mb-4">
            <i class="pi pi-times-circle response-icon response-icon--error"></i>
          </div>
          <div class="text-center">
            <h5 class="mb-3 font-bold md:text-3xl text-2xl">{{ $t('components.changepassword.operationFailed') }}</h5>
            <p class="response-text">
              {{$t('components.changepassword.operationFailedExtended')}}: <b>{{email}}</b>: {{error}}
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
            <Password
              placeholder="Password*"
              id="password" v-model="v$.password.$model" :class="{'p-invalid':v$.password.$invalid && submitted}" toggleMask>
              <template #header>
                <h6>{{$t('components.changepassword.formText.pickAPassword')}}</h6>
              </template>
              <template #footer="sp">
                {{sp.level}}
                <Divider />
                <p class="p-mt-2">{{$t('components.changepassword.formText.suggestions')}}</p>
                <ul class="p-pl-2 p-ml-2 p-mt-0" style="line-height: 1.5">
                  <li>{{$t('components.changepassword.formText.oneLowecase')}}</li>
                  <li>{{$t('components.changepassword.formText.oneUppercase')}}</li>
                  <li>{{$t('components.changepassword.formText.oneNumeric')}}</li>
                  <li>{{$t('components.changepassword.formText.oneSymbol')}}</li>
                  <li>{{$t('components.changepassword.formText.atLeastNChars')}}</li>
                </ul>
              </template>
            </Password>

            <small v-if="(v$.password.$invalid && submitted) || v$.password.$pending.$response" class="p-error">
              <div
                  v-for="error in v$.password.$errors"
                  :key="error"
              >
                {{ error.$message.replace('Value', 'Password') }}
              </div>
            </small>
          </div>
          <div class="text-center">
            <Button type="submit" :label="$t('components.changepassword.submitButton')" class="p-mt-2 md:w-auto py-3 px-6 w-full" />
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { required, minLength} from "@vuelidate/validators"
import { updatePassword } from "firebase/auth";
import { useVuelidate } from "@vuelidate/core"
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'

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
      password: '',
      error: null,
      submitted: false,
      showMessage: false
    }
  },
  validations() {
    return {
      password: {
        required,
        minLengthValue: minLength(8),
      }
    }
  },
  created() {
  },
  mounted() {
  },
  methods: {
    async handleSubmit(isFormValid) {
      this.submitted = true;

      if (!isFormValid) {
        return;
      }

      updatePassword(this.store.state.user, this.password).then(() => {
        // Update successful.
        console.debug("Password successfully changed")
      }).catch((error) => {
        this.error = error.message
      });

      this.toggleDialog();
    },
    toggleDialog() {
      this.showMessage = !this.showMessage;

      if(!this.showMessage) {
        this.resetForm();
      }
    },
    resetForm() {
      this.password = '';
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

.change-password-form {
  .card {
    width: auto;

    .p-field {
      margin-bottom: 1.5rem;
    }
  }
}
</style>
