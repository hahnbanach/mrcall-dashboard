<template>
  <Toast/>
  <ConfirmDialog/>
  <ProgressBar v-if="loading" mode="indeterminate" style="height: .3em"/>

  <!-- Not connected -->
  <div v-if="!loading && !connected" class="whatsapp-cloud-section center">
    <p class="title text-center mb-4 md:text-5xl text-4xl">{{ $t('components.whatsappCloud.connectTitle') }}</p>
    <p class="subtitle text-center mb-1 md:text-2xl text-1xl">{{ $t('components.whatsappCloud.connectSubtitle') }}</p>
    <br>
    <Button
        :label="$t('components.whatsappCloud.connectButton')"
        icon="pi pi-whatsapp"
        @click="startEmbeddedSignup"
        :loading="signingUp"
    />
  </div>

  <!-- Connected -->
  <div v-if="!loading && connected" class="whatsapp-cloud-section">
    <!-- Status card -->
    <Card class="mb-4">
      <template #title>{{ $t('components.whatsappCloud.statusTitle') }}</template>
      <template #content>
        <div class="flex flex-column gap-3">
          <div class="flex align-items-center gap-2">
            <i class="pi pi-check-circle" style="color: green; font-size: 1.2rem;"></i>
            <span>{{ $t('components.whatsappCloud.connected') }}</span>
          </div>
          <div v-if="status.phoneNumber" class="flex align-items-center gap-2">
            <strong>{{ $t('components.whatsappCloud.phoneNumber') }}:</strong>
            <span>{{ status.phoneNumber }}</span>
          </div>
          <div v-if="status.displayName" class="flex align-items-center gap-2">
            <strong>{{ $t('components.whatsappCloud.displayName') }}:</strong>
            <span>{{ status.displayName }}</span>
          </div>
          <div v-if="status.qualityRating" class="flex align-items-center gap-2">
            <strong>{{ $t('components.whatsappCloud.qualityRating') }}:</strong>
            <span>{{ status.qualityRating }}</span>
          </div>
        </div>
        <div class="mt-4">
          <Button
              :label="$t('components.whatsappCloud.revoke')"
              icon="pi pi-times"
              severity="danger"
              outlined
              @click="confirmRevoke"
          />
        </div>
      </template>
    </Card>

    <!-- Send message card -->
    <Card class="mb-4">
      <template #title>{{ $t('components.whatsappCloud.sendMessageTitle') }}</template>
      <template #content>
        <div class="flex flex-column gap-3">
          <div class="flex flex-column gap-2">
            <label>{{ $t('components.whatsappCloud.recipientPhone') }}</label>
            <InputText v-model="sendForm.to" placeholder="+39..." />
          </div>
          <div class="flex flex-column gap-2">
            <label>{{ $t('components.whatsappCloud.messageType') }}</label>
            <Dropdown
                v-model="sendForm.type"
                :options="messageTypes"
                optionLabel="label"
                optionValue="value"
            />
          </div>
          <div v-if="sendForm.type === 'text'" class="flex flex-column gap-2">
            <label>{{ $t('components.whatsappCloud.messageText') }}</label>
            <Textarea v-model="sendForm.text" rows="3" />
          </div>
          <div v-if="sendForm.type === 'template'" class="flex flex-column gap-2">
            <label>{{ $t('components.whatsappCloud.templateName') }}</label>
            <InputText v-model="sendForm.templateName" />
          </div>
          <Button
              :label="$t('components.whatsappCloud.sendButton')"
              icon="pi pi-send"
              @click="sendMessage"
              :loading="sending"
              :disabled="!sendForm.to"
          />
        </div>
      </template>
    </Card>

    <!-- Chat history card -->
    <Card>
      <template #title>{{ $t('components.whatsappCloud.chatHistoryTitle') }}</template>
      <template #content>
        <div class="mb-3">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText
                v-model="contactFilter"
                :placeholder="$t('components.whatsappCloud.filterByContact')"
                @keyup.enter="loadMessages"
            />
          </IconField>
        </div>
        <DataTable
            :value="messages"
            :loading="loadingMessages"
            :paginator="true"
            :rows="10"
            :totalRecords="totalMessages"
            :lazy="true"
            @page="onPage"
            stripedRows
        >
          <Column field="direction" :header="$t('components.whatsappCloud.direction')" style="width: 8rem;">
            <template #body="slotProps">
              <i :class="slotProps.data.direction === 'inbound' ? 'pi pi-arrow-down-left' : 'pi pi-arrow-up-right'"></i>
              {{ slotProps.data.direction }}
            </template>
          </Column>
          <Column field="contact" :header="$t('components.whatsappCloud.contact')" />
          <Column field="type" :header="$t('components.whatsappCloud.type')" style="width: 8rem;" />
          <Column field="text" :header="$t('components.whatsappCloud.message')" />
          <Column field="timestamp" :header="$t('components.whatsappCloud.timestamp')" style="width: 12rem;">
            <template #body="slotProps">
              {{ formatTimestamp(slotProps.data.timestamp) }}
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>

<script>
import { useStore } from "vuex";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { computed } from "vue";
import WhatsappCloud from "@/utils/WhatsappCloud";

export default {
  name: "WhatsappCloudApi",
  setup() {
    const store = useStore();
    const toast = useToast();
    const confirm = useConfirm();
    return { store, toast, confirm };
  },
  data() {
    const businessId = this.$route.query?.businessId;
    return {
      businessId,
      user: computed(() => this.store.state.user),
      loading: true,
      connected: false,
      signingUp: false,
      sending: false,
      loadingMessages: false,
      status: {},
      sendForm: {
        to: "",
        type: "text",
        text: "",
        templateName: ""
      },
      messageTypes: [
        { label: "Text", value: "text" },
        { label: "Template", value: "template" }
      ],
      contactFilter: "",
      messages: [],
      totalMessages: 0,
      currentPage: 0,
      pageSize: 10,
      fbSdkLoaded: false
    };
  },
  async created() {
    await this.checkStatus();
  },
  methods: {
    async checkStatus() {
      this.loading = true;
      try {
        const data = await WhatsappCloud.getStatus(this.user, this.businessId);
        this.connected = data.connected || false;
        this.status = data;
        if (this.connected) {
          await this.loadMessages();
        }
      } catch (e) {
        console.error("WhatsApp Cloud status check failed:", e);
        this.connected = false;
      } finally {
        this.loading = false;
      }
    },
    async loadFbSdk() {
      if (this.fbSdkLoaded) return;
      return new Promise((resolve, reject) => {
        if (window.FB) {
          this.fbSdkLoaded = true;
          resolve();
          return;
        }
        window.fbAsyncInit = () => {
          window.FB.init({
            appId: process.env.VUE_APP_META_APP_ID,
            autoLogAppEvents: true,
            xfbml: false,
            version: "v21.0"
          });
          this.fbSdkLoaded = true;
          resolve();
        };
        const script = document.createElement("script");
        script.src = "https://connect.facebook.net/en_US/sdk.js";
        script.async = true;
        script.defer = true;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    },
    async startEmbeddedSignup() {
      this.signingUp = true;
      try {
        await this.loadFbSdk();

        const sessionInfo = await new Promise((resolve) => {
          const listener = (event) => {
            if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
            try {
              const data = JSON.parse(event.data);
              if (data.type === "WA_EMBEDDED_SIGNUP") {
                window.removeEventListener("message", listener);
                resolve(data);
              }
            } catch { /* ignore non-JSON messages */ }
          };
          window.addEventListener("message", listener);

          window.FB.login((response) => {
            if (response.authResponse) {
              const code = response.authResponse.code;
              if (code) {
                resolve({ code });
              }
            }
          }, {
            config_id: process.env.VUE_APP_META_CONFIG_ID || undefined,
            response_type: "code",
            override_default_response_type: true,
            extras: {
              setup: {},
              featureType: "",
              sessionInfoVersion: 2
            },
            scope: "business_management,whatsapp_business_management,whatsapp_business_messaging"
          });
        });

        const credentials = {
          businessId: this.businessId,
          ...sessionInfo
        };

        await WhatsappCloud.signupCallback(this.user, credentials);
        this.toast.add({ severity: "success", summary: this.$t("components.whatsappCloud.toast.signupSuccess"), life: 3000 });
        await this.checkStatus();
      } catch (e) {
        console.error("Embedded signup failed:", e);
        this.toast.add({ severity: "error", summary: this.$t("components.whatsappCloud.toast.signupFailed"), life: 5000 });
      } finally {
        this.signingUp = false;
      }
    },
    confirmRevoke() {
      this.confirm.require({
        header: this.$t("components.whatsappCloud.revokeConfirmTitle"),
        message: this.$t("components.whatsappCloud.revokeConfirmMessage"),
        icon: "pi pi-exclamation-triangle",
        acceptClass: "p-button-danger",
        accept: () => this.revokeCredentials()
      });
    },
    async revokeCredentials() {
      try {
        await WhatsappCloud.revokeCredentials(this.user, this.businessId);
        this.toast.add({ severity: "success", summary: this.$t("components.whatsappCloud.toast.revokeSuccess"), life: 3000 });
        this.connected = false;
        this.status = {};
        this.messages = [];
        this.totalMessages = 0;
      } catch (e) {
        console.error("Revoke failed:", e);
        this.toast.add({ severity: "error", summary: this.$t("components.whatsappCloud.toast.revokeFailed"), life: 5000 });
      }
    },
    async sendMessage() {
      this.sending = true;
      try {
        const payload = {
          businessId: this.businessId,
          to: this.sendForm.to,
          type: this.sendForm.type
        };
        if (this.sendForm.type === "text") {
          payload.text = this.sendForm.text;
        } else if (this.sendForm.type === "template") {
          payload.templateName = this.sendForm.templateName;
        }
        await WhatsappCloud.sendMessage(this.user, payload);
        this.toast.add({ severity: "success", summary: this.$t("components.whatsappCloud.toast.messageSent"), life: 3000 });
        this.sendForm.text = "";
        this.sendForm.templateName = "";
        await this.loadMessages();
      } catch (e) {
        console.error("Send message failed:", e);
        this.toast.add({ severity: "error", summary: this.$t("components.whatsappCloud.toast.sendFailed"), life: 5000 });
      } finally {
        this.sending = false;
      }
    },
    async loadMessages() {
      this.loadingMessages = true;
      try {
        const data = await WhatsappCloud.getMessages(this.user, {
          businessId: this.businessId,
          contact: this.contactFilter || undefined,
          limit: this.pageSize,
          offset: this.currentPage * this.pageSize
        });
        if (Array.isArray(data)) {
          this.messages = data;
          this.totalMessages = data.length >= this.pageSize ? (this.currentPage + 2) * this.pageSize : (this.currentPage * this.pageSize) + data.length;
        } else if (data && data.messages) {
          this.messages = data.messages;
          this.totalMessages = data.total || data.messages.length;
        } else {
          this.messages = [];
          this.totalMessages = 0;
        }
      } catch (e) {
        console.error("Load messages failed:", e);
        this.messages = [];
        this.totalMessages = 0;
      } finally {
        this.loadingMessages = false;
      }
    },
    onPage(event) {
      this.currentPage = event.page;
      this.loadMessages();
    },
    formatTimestamp(ts) {
      if (!ts) return "";
      const date = new Date(ts);
      return date.toLocaleString();
    }
  }
};
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';

.whatsapp-cloud-section {
  padding: 1rem;
}
.whatsapp-cloud-section.center {
  text-align: center;
}
</style>
