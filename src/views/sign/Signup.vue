<script>
import Sign from '@/components/templates/sign/Sign.vue'
import Signup from '@/components/templates/sign/Signup.vue'
import { useI18n } from 'vue-i18n'

export default {
  components: {
    Sign,
    Signup
  },
  setup() {
    const { t } = useI18n()
    return { t }
  }
}
</script>

<template>
  <Sign>
    <!-- ─── LEFT PANEL: messaging ─── -->
    <template #messaging>
      <div class="signup-messaging">
        <h1 class="signup-headline">
          {{ t('views.sign.signup.heroHeadline') }}
          <span class="signup-headline-accent">{{ t('views.sign.signup.heroAccent') }}</span>
        </h1>
        <p class="signup-subheadline">{{ t('views.sign.signup.heroSubheadline') }}</p>

        <ul class="signup-benefits">
          <li>
            <i class="pi pi-check-circle"></i>
            <span>{{ t('views.sign.signup.benefit1') }}</span>
          </li>
          <li>
            <i class="pi pi-check-circle"></i>
            <span>{{ t('views.sign.signup.benefit2') }}</span>
          </li>
          <li>
            <i class="pi pi-check-circle"></i>
            <span>{{ t('views.sign.signup.benefit3') }}</span>
          </li>
        </ul>

        <div class="signup-trust">
          <span class="signup-trust-badge">
            <i class="pi pi-shield"></i>
            {{ t('views.sign.signup.trustBadge') }}
          </span>
        </div>
      </div>
    </template>

    <!-- ─── FORM TITLE ─── -->
    <template #title>
      {{ t('views.sign.signup.titleText') }}
    </template>

    <!-- ─── FORM CONTENT ─── -->
    <template #content>
      <Signup />
    </template>

    <!-- ─── BELOW FORM: terms + sign-in link ─── -->
    <template #signin-signup-alternative>
      <div class="text-center">
        <div class="terms-privacy mt-3">
          {{ t('components.templates.sign.signup.temsAndPrivacyPolicyStatement.firstStatement') }}
          <a :href="t('components.templates.sign.signup.temsAndPrivacyPolicyStatement.terms.link')" class="link">
            {{ t('components.templates.sign.signup.temsAndPrivacyPolicyStatement.terms.text') }}
          </a>
          {{ t('components.templates.sign.signup.temsAndPrivacyPolicyStatement.connective') }}
          <a :href="t('components.templates.sign.signup.temsAndPrivacyPolicyStatement.privacy.link')" class="link">
            {{ t('components.templates.sign.signup.temsAndPrivacyPolicyStatement.privacy.text') }}
          </a>
        </div>

        <div class="mt-3">
          <span class="companion-text">{{ t('components.templates.sign.signup.signinLinkCompanionText') }}</span>
          <span class="companion-text">&nbsp;</span>
          <a href="/signin" class="link">{{ t('components.templates.sign.signup.signinLinkLabel') }}</a>
        </div>
      </div>
    </template>
  </Sign>
</template>

<style scoped lang="less">
@import '../../assets/style/colors';

/* ─── Messaging panel content ─── */
.signup-messaging {
  max-width: 480px;
}

.signup-headline {
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 2.5rem;
  line-height: 1.15;
  color: @mrcall_black;
  margin: 0;

  @media screen and (max-width: 959px) {
    font-size: 1.5rem;
    text-align: center;
  }
}

.signup-headline-accent {
  color: @mrcall_blue;
}

.signup-subheadline {
  font-family: 'Inter', sans-serif;
  font-size: 1.1rem;
  line-height: 1.6;
  color: @mrcall_grey_text;
  margin-top: 16px;

  @media screen and (max-width: 959px) {
    display: none;
  }
}

.signup-benefits {
  list-style: none;
  padding: 0;
  margin: 32px 0 0 0;

  li {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    font-family: 'Inter', sans-serif;
    font-size: 1rem;
    color: @mrcall_dark_grey_text;
  }

  .pi-check-circle {
    color: @mrcall_blue;
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  @media screen and (max-width: 959px) {
    display: none;
  }
}

.signup-trust {
  margin-top: 24px;

  @media screen and (max-width: 959px) {
    display: none;
  }
}

.signup-trust-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: @mrcall_light_grey_2;
  border-radius: 20px;
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  color: @mrcall_grey_text2;

  .pi-shield {
    font-size: 1rem;
  }
}

/* ─── Existing below-form styles ─── */
.terms-privacy {
  font-size: 0.9em;
  color: #666;

  .link {
    text-decoration: none;
    color: @mrcall_blue;

    &:hover {
      text-decoration: underline;
    }
  }
}

.mt-3 {
  margin-top: 1rem;
}
</style>
