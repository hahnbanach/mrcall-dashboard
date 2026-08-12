<template>
  <div class="account-section main-page-content-section">
    <h1 class="account-heading">{{ $t('components.accountTitle') }}</h1>
    <div class="content">
      <!-- CTA: Create New Assistant -->
      <Card class="create-assistant-card">
        <template #title>{{ $t('components.navbar.createAssistant') }}</template>
        <template #subtitle>{{ $t('components.account.createAssistantSubtitle') }}</template>
        <template #content>
          <div class="text-center">
            <Button
              :label="$t('components.navbar.createAssistant')"
              icon="pi pi-plus-circle"
              class="md:w-auto py-3 px-6 w-full"
              @click="$router.push('/onboardinglang')"
            />
          </div>
        </template>
      </Card>

      <!-- Security Section -->
      <div class="section-group">
        <h2 class="section-heading">
          <i class="pi pi-shield"></i> {{ $t('components.account.securitySectionTitle') }}
        </h2>
        <Card class="account-card">
          <template #title>{{ $t('components.changepassword.changePasswordTitle') }}</template>
          <template #subtitle>{{ $t('components.changepassword.changePasswordSubtitle') }}</template>
          <template #content>
            <ChangePassword></ChangePassword>
          </template>
        </Card>

        <Card class="account-card">
          <template #title>{{ $t('components.changeemail.changeEmailTitle') }}</template>
          <template #subtitle>{{ store.state.user ? store.state.user.email : '' }}</template>
          <template #content>
            <ChangeEmail></ChangeEmail>
          </template>
        </Card>
      </div>

      <!-- Integrations Section -->
      <div class="section-group">
        <h2 class="section-heading">
          <i class="pi pi-link"></i> {{ $t('components.account.integrationsSectionTitle') }}
        </h2>
        <Card class="account-card">
          <template #title>{{ $t('components.connectCalendar.title') }}</template>
          <template #subtitle>{{ $t('components.connectCalendar.description') }}</template>
          <template #content>
            <ConnectCalendar></ConnectCalendar>
          </template>
        </Card>

        <Card class="account-card">
          <template #title>{{ $t('components.account.mcpConnectors.title') }}</template>
          <template #subtitle>{{ $t('components.account.mcpConnectors.description') }}</template>
          <template #content>
            <Button
              :label="$t('components.account.mcpConnectors.manage')"
              icon="pi pi-cog"
              @click="goToMcpConnectors"
            />
          </template>
        </Card>
      </div>

      <!-- Danger Zone -->
      <div class="section-group danger-zone">
        <h2 class="section-heading section-heading--danger">
          <i class="pi pi-exclamation-triangle"></i> {{ $t('components.account.dangerZoneSectionTitle') }}
        </h2>
        <Card class="danger-card">
          <template #title>{{ $t('components.deleteaccount.deleteAccountTitle') }}</template>
          <template #content>
            <DeleteAccount></DeleteAccount>
          </template>
        </Card>
      </div>
    </div>
  </div>
  <footer id="pre-footer">
    <PreFooterRequireAssistance/>
  </footer>
</template>

<script>
import ChangePassword from "@/components/ChangePassword";
import ChangeEmail from "@/components/ChangeEmail";
import DeleteAccount from "@/components/DeleteAccount";
import ConnectCalendar from "@/components/ConnectCalendar";
import PreFooterRequireAssistance from "@/components/PreFooterRequireAssistance";
import { useStore } from 'vuex'

export default {
  components: {
    ChangePassword,
    ChangeEmail,
    DeleteAccount,
    ConnectCalendar,
    PreFooterRequireAssistance
  },
  setup() {
    const store = useStore()
    return { store }
  },
  data() {
    return {}
  },
  mounted() {
    window.scrollTo(0, 0);
  },
  methods: {
    goToMcpConnectors() {
      this.$router.push({ name: "McpConnectors" })
    }
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';

/* ===== Page heading ===== */
.account-heading {
  font-family: 'Montserrat', sans-serif;
  font-size: 1.75rem;
  font-weight: 700;
  color: @mrcall_blue;
  margin-bottom: 2rem;
}

/* ===== Content container ===== */
.content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 100%;
  margin: 0 auto;

  @media (min-width: 768px) {
    max-width: 600px;
  }
}

/* ===== Section groups ===== */
.section-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-heading {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: @mrcall_grey_text2;
  margin: 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid @mrcall_borders;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  i {
    font-size: 0.85rem;
  }

  &--danger {
    color: @mrcall_status_error;
    border-bottom-color: fade(@mrcall_status_error, 30%);
  }
}

/* ===== Base card styling ===== */
.content :deep(.p-card) {
  background: @mrcall_white;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.content :deep(.p-card-body) {
  padding: 1.25rem 1.5rem;
}

.content :deep(.p-card-title) {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 1.05rem;
  font-weight: 600;
  color: @mrcall_dark_grey_text;
  margin-bottom: 0.25rem;
}

.content :deep(.p-card-subtitle) {
  font-size: 0.875rem;
  color: @mrcall_grey_text2;
  line-height: 1.5;
  margin-bottom: 0;
}

.content :deep(.p-card-content) {
  padding-top: 1rem;
}

/* ===== CTA card (Create New Assistant) ===== */
.content :deep(.create-assistant-card.p-card) {
  border: 2px solid @mrcall_blue;
  background: fade(@mrcall_blue, 4%);
  box-shadow: 0 2px 8px rgba(0, 104, 255, 0.1);

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 104, 255, 0.18);
  }

  .p-card-title {
    color: @mrcall_blue;
    font-weight: 700;
  }
}

/* ===== Danger card ===== */
.content :deep(.danger-card.p-card) {
  border: 1px solid fade(@mrcall_status_error, 40%);
  background: fade(@mrcall_status_error, 3%);

  &:hover {
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);
  }

  .p-card-title {
    color: @mrcall_status_error;
    font-weight: 600;
  }
}

/* ===== Danger zone separator ===== */
.danger-zone {
  margin-top: 1rem;
  padding-top: 1.5rem;
  border-top: 2px dashed fade(@mrcall_status_error, 25%);
}

/* ===== Pre-footer ===== */
#pre-footer {
  margin-top: auto;
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

/* ===== Mobile responsive ===== */
@media screen and (max-width: 640px) {
  .account-heading {
    font-size: 1.5rem;
    margin-bottom: 1.25rem;
  }

  .content {
    gap: 1.5rem;
  }

  .content :deep(.p-card-body) {
    padding: 1rem 1.25rem;
  }

  .section-heading {
    font-size: 0.75rem;
  }
}
</style>
